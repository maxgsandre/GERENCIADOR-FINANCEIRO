import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type CartaoCreditoBackup = {
  id: string;
  nome: string;
  observacao?: string;
  limite?: number;
  diaVencimento?: number;
};

type CompraCartaoBackup = {
  id: string;
  cardId: string;
  descricao: string;
  valorTotal: number;
  parcelas: number;
  valorParcela: number;
  startMonth: string; // YYYY-MM
  dataCompra: string; // YYYY-MM-DD
  parcelasPagas?: number;
  valorPago?: number;
  startDay?: number;
};

type BackupShape = {
  cartoes?: CartaoCreditoBackup[];
  comprasCartao?: CompraCartaoBackup[];
};

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, maybeV] = a.split('=');
    const key = k.replace(/^--/, '');
    if (maybeV !== undefined) args[key] = maybeV;
    else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function ymToIndex(y: number, m1to12: number) {
  return y * 12 + (m1to12 - 1);
}

function addMonths(ym: string, add: number) {
  const [y, m] = ym.split('-').map(Number);
  const idx = ymToIndex(y, m) + add;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function installmentValue(valorTotal: number, valorParcelaBase: number, totalParcelas: number, index0: number) {
  const delta = Math.round(valorTotal * 100) - Math.round(valorParcelaBase * 100) * totalParcelas;
  const isLast = index0 === totalParcelas - 1;
  return valorParcelaBase + (isLast ? delta / 100 : 0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const userId = String(args.userId || '');
  if (!userId) {
    throw new Error('Parâmetro obrigatório ausente: --userId <UID>');
  }

  const backupFile = String(args.backup || 'backup-2026-03-17.json');
  const backupPath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(process.cwd(), backupFile);

  const serviceAccountPath = String(args.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS || '');
  if (!serviceAccountPath) {
    throw new Error(
      'Informe as credenciais do Firebase Admin com --serviceAccount <caminho.json> ou defina FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  const projectId = String(args.projectId || process.env.FIREBASE_PROJECT_ID || '');
  if (!projectId) {
    throw new Error('Informe o projectId com --projectId <id> ou defina FIREBASE_PROJECT_ID no ambiente.');
  }

  const dryRun = args.dryRun === true || String(args.dryRun || '').toLowerCase() === 'true';
  const wipe = args.wipe === true || String(args.wipe || '').toLowerCase() === 'true';

  if (!getApps().length) {
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    const sa = JSON.parse(raw);
    initializeApp({
      credential: cert(sa),
      projectId,
    });
  }

  const db = getFirestore();

  const rawBackup = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(rawBackup) as BackupShape;

  const cartoes = backup.cartoes || [];
  const compras = backup.comprasCartao || [];

  if (!cartoes.length) {
    throw new Error('Backup não possui "cartoes" (ou está vazio).');
  }

  const comprasSemCartao = compras.filter((c) => !c.cardId);
  if (comprasSemCartao.length) {
    throw new Error(`Backup possui ${comprasSemCartao.length} compra(s) sem cardId.`);
  }

  const cardsById = new Map(cartoes.map((c) => [c.id, c]));
  const comprasInvalidas = compras.filter((c) => !cardsById.has(c.cardId));
  if (comprasInvalidas.length) {
    throw new Error(`Backup possui ${comprasInvalidas.length} compra(s) com cardId inexistente em "cartoes".`);
  }

  if (wipe) {
    const creditCardsCol = db.collection('users').doc(userId).collection('creditCards');
    const cardsSnap = await creditCardsCol.get();
    if (!dryRun) {
      for (const cardDoc of cardsSnap.docs) {
        // remove subcoleções conhecidas
        await db.recursiveDelete(cardDoc.ref.collection('compras')).catch(() => undefined);
        await db.recursiveDelete(cardDoc.ref.collection('faturas')).catch(() => undefined);
        await cardDoc.ref.delete().catch(() => undefined);
      }
    }
  }

  const batchLimit = 400;
  let batch = db.batch();
  let ops = 0;
  const commitBatch = async () => {
    if (!ops) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  // 1) Criar/atualizar cartões
  for (const c of cartoes) {
    const ref = db.collection('users').doc(userId).collection('creditCards').doc(c.id);
    batch.set(ref, { ...c, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    ops++;
    if (ops >= batchLimit) await commitBatch();
  }

  // 2) Criar/atualizar compras e materializar em faturas/{YYYY-MM}/itens
  for (const p of compras) {
    const totalParcelas = Math.max(1, p.parcelas || 1);
    const valorParcelaBase = p.valorParcela || (p.valorTotal / totalParcelas);
    const parcelasPagas = Math.max(0, Math.min(totalParcelas, p.parcelasPagas || 0));

    // Corrigir valorPago inconsistentes: usa o maior entre o salvo e o equivalente às parcelasPagas
    let pagoCalculado = 0;
    for (let i = 0; i < parcelasPagas; i++) {
      pagoCalculado += installmentValue(p.valorTotal, valorParcelaBase, totalParcelas, i);
    }
    const valorPago = Math.max(p.valorPago || 0, pagoCalculado);

    const compraPayload: any = {
      ...p,
      parcelas: totalParcelas,
      valorParcela: valorParcelaBase,
      parcelasPagas,
      valorPago,
      updatedAt: FieldValue.serverTimestamp(),
    };
    Object.keys(compraPayload).forEach((k) => {
      if (compraPayload[k] === undefined) delete compraPayload[k];
    });

    const compraRef = db
      .collection('users')
      .doc(userId)
      .collection('creditCards')
      .doc(p.cardId)
      .collection('compras')
      .doc(p.id);

    batch.set(compraRef, compraPayload, { merge: true });
    ops++;
    if (ops >= batchLimit) await commitBatch();

    // Materializar parcelas em faturas mensais (itens)
    for (let i = 0; i < totalParcelas; i++) {
      const ym = addMonths(p.startMonth, i);
      const itemId = `${p.id}-${i + 1}`; // igual ao padrão do firebaseService
      const valor = installmentValue(p.valorTotal, valorParcelaBase, totalParcelas, i);
      const item: any = {
        id: itemId,
        purchaseId: p.id,
        cardId: p.cardId,
        descricao: p.descricao,
        valor,
        parcela: i + 1,
        parcelasTotais: totalParcelas,
        startMonth: p.startMonth,
        pago: i < parcelasPagas,
        updatedAt: FieldValue.serverTimestamp(),
      };

      const itemRef = db
        .collection('users')
        .doc(userId)
        .collection('creditCards')
        .doc(p.cardId)
        .collection('faturas')
        .doc(ym)
        .collection('itens')
        .doc(itemId);

      batch.set(itemRef, item, { merge: true });
      ops++;
      if (ops >= batchLimit) await commitBatch();
    }
  }

  await commitBatch();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


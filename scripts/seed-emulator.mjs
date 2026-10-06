/**
 * Popula o emulador do Firebase com um cenário conhecido.
 *
 * Uso:
 *   npm run emulator        # em um terminal
 *   npm run emulator:seed   # em outro
 *
 * Usa o SDK cliente (já dependência do projeto) apontado para o emulador, em vez
 * do firebase-admin, para não adicionar dependência só por causa do seed.
 *
 * Recusa rodar se os emuladores não estiverem no ar: escrever sem querer no
 * Firestore de produção seria pior do que falhar.
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-gerenciador-financeiro';
const AUTH_PORT = 9099;
const FIRESTORE_PORT = 8080;

const EMAIL = 'teste@exemplo.local';
const SENHA = 'teste123';

/** Mês base do cenário. Fixo, para os testes poderem afirmar valores exatos. */
const MES = '2026-09';

const garantirEmuladorNoAr = async () => {
  try {
    const resposta = await fetch(`http://127.0.0.1:${AUTH_PORT}/`);
    if (!resposta.ok) throw new Error(String(resposta.status));
  } catch {
    console.error(
      `\nEmulador não encontrado em 127.0.0.1:${AUTH_PORT}.\n` +
        `Suba com "npm run emulator" antes de rodar o seed.\n`
    );
    process.exit(1);
  }
};

const conectar = () => {
  const app = initializeApp({ apiKey: 'emulador', projectId: PROJECT_ID });
  const auth = getAuth(app);
  const db = getFirestore(app);

  connectAuthEmulator(auth, `http://127.0.0.1:${AUTH_PORT}`, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', FIRESTORE_PORT);

  return { auth, db };
};

const entrarOuCriar = async (auth) => {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, EMAIL, SENHA);
    return user;
  } catch (erro) {
    if (erro?.code !== 'auth/email-already-in-use') throw erro;
    const { user } = await signInWithEmailAndPassword(auth, EMAIL, SENHA);
    return user;
  }
};

// ---------------------------------------------------------------------------
// Cenário
// ---------------------------------------------------------------------------

const caixas = [
  { id: 'caixa-corrente', nome: 'Conta Corrente', saldo: 0, tipo: 'conta_corrente', initialByMonth: { [MES]: 2000 } },
  { id: 'caixa-carteira', nome: 'Carteira', saldo: 0, tipo: 'carteira', initialByMonth: { [MES]: 150 } },
];

const categorias = [
  { id: 'cat-moradia', nome: 'Moradia' },
  { id: 'cat-transporte', nome: 'Transporte' },
  { id: 'cat-lazer', nome: 'Lazer/Saídas' },
];

const transacoes = [
  { id: 'tx-salario', caixaId: 'caixa-corrente', tipo: 'entrada', valor: 5000, descricao: 'Salário', categoria: 'Salário', data: `${MES}-05`, hora: '09:00' },
  { id: 'tx-mercado', caixaId: 'caixa-corrente', tipo: 'saida', valor: 350.5, descricao: 'Mercado', categoria: 'Feira', data: `${MES}-08`, hora: '18:30' },
];

const gastosFixos = [
  { id: 'gf-aluguel', descricao: 'Aluguel', valor: 1200, categoria: 'Moradia', diaVencimento: 10, pago: false, periodo: MES },
  { id: 'gf-internet', descricao: 'Internet', valor: 99.9, categoria: 'Utilidades', diaVencimento: 15, pago: true, valorPago: 99.9, periodo: MES },
];

const receitas = [
  { id: 'rc-salario', descricao: 'Salário', valor: 5000, recebido: true, dataVencimento: `${MES}-05`, periodo: MES, diaVencimento: 5, caixaId: 'caixa-corrente' },
];

/**
 * Dívida parcelada quitada antecipadamente: as parcelas a partir de outubro
 * ficam inativas. É o cenário do bug que inflava o Dashboard — o seed existe
 * justamente para que um teste possa provar que elas não entram nos totais.
 */
const criarParcelas = () => {
  const parcelas = [];
  const totalParcelas = 6;
  const valorParcela = 500;

  for (let i = 0; i < totalParcelas; i++) {
    const mes = 9 + i;
    const ano = 2026 + Math.floor((mes - 1) / 12);
    const periodo = `${ano}-${String(((mes - 1) % 12) + 1).padStart(2, '0')}`;
    const quitadaAntecipadamente = i > 0;

    parcelas.push({
      periodo,
      item: {
        id: `divida-carro-${i + 1}`,
        debtId: 'divida-carro',
        descricao: 'Financiamento Carro',
        valorTotal: valorParcela * totalParcelas,
        valorPago: i === 0 ? valorParcela : 0,
        parcelas: totalParcelas,
        parcelasPagas: i === 0 ? 1 : 0,
        parcelaIndex: i + 1,
        // parcelaTotal e o que permite a aba de Dividas agrupar as parcelas de
        // uma mesma divida; sem ele, cada parcela conta como divida inteira.
        parcelaTotal: totalParcelas,
        valorParcela,
        dataVencimento: `${periodo}-20`,
        tipo: 'parcelada',
        categoria: 'Transporte',
        periodo,
        ...(quitadaAntecipadamente ? { inativa: true } : {}),
      },
    });
  }
  return parcelas;
};

/** Uma esporádica ativa, para o mês ter algum valor que não venha de parcela. */
const esporadica = {
  id: 'divida-mercadinho',
  descricao: 'Mercadinho',
  valorTotal: 80,
  valorPago: 80,
  parcelas: 1,
  parcelasPagas: 1,
  valorParcela: 80,
  dataVencimento: `${MES}-03`,
  tipo: 'total',
  categoria: 'Lazer/Saídas',
  pago: true,
  periodo: MES,
};

const semear = async (db, uid) => {
  const gravacoes = [];
  const sob = (...caminho) => doc(db, 'users', uid, ...caminho);

  gravacoes.push(setDoc(doc(db, 'users', uid), { email: EMAIL, nome: 'Usuário de Teste' }));

  caixas.forEach((c) => gravacoes.push(setDoc(sob('caixas', c.id), c)));
  categorias.forEach((c) => gravacoes.push(setDoc(sob('categorias', c.id), c)));
  transacoes.forEach((t) => gravacoes.push(setDoc(sob('transacoes', MES, 'itens', t.id), t)));
  gastosFixos.forEach((g) => gravacoes.push(setDoc(sob('gastosFixos', MES, 'itens', g.id), g)));
  receitas.forEach((r) => gravacoes.push(setDoc(sob('receitasPrevistas', MES, 'receitas', r.id), r)));

  criarParcelas().forEach(({ periodo, item }) =>
    gravacoes.push(setDoc(sob('dividas', periodo, 'itens', item.id), item))
  );
  gravacoes.push(setDoc(sob('dividas', MES, 'itens', esporadica.id), esporadica));

  await Promise.all(gravacoes);
  return gravacoes.length;
};

// ---------------------------------------------------------------------------

await garantirEmuladorNoAr();

const { auth, db } = conectar();
const usuario = await entrarOuCriar(auth);
const total = await semear(db, usuario.uid);

console.log(`
Emulador populado.

  usuário    ${EMAIL}
  senha      ${SENHA}
  uid        ${usuario.uid}
  documentos ${total}

Cenário de ${MES}:
  2 caixas (saldo inicial somando R$ 2.150,00)
  1 receita prevista de R$ 5.000,00
  2 gastos fixos somando R$ 1.299,90
  1 parcela ativa de R$ 500,00 + 5 parcelas inativas (quitação antecipada)
  1 gasto esporádico de R$ 80,00

Painel do emulador: http://127.0.0.1:4000
`);

process.exit(0);

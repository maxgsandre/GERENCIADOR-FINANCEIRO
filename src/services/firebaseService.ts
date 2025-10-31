import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  onSnapshot, 
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Caixa, Transacao, GastoFixo, Divida, Cofrinho, Categoria, ReceitaPrevista, CartaoCredito, CompraCartao } from '../App';

// Função para criar documento do usuário
export const createUserDocument = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    const userData = {
      email: user.email,
      name: user.displayName || 'Usuário',
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    };
    
    await setDoc(userRef, userData);
    
    // Criar dados iniciais
    await initializeUserData(user.uid);
  }
};

// Função para inicializar dados do usuário
const initializeUserData = async (userId: string) => {
  const initialData = {
    caixas: [
      { id: '1', nome: 'Conta Corrente', saldo: 0, tipo: 'conta_corrente', initialByMonth: {} },
      { id: '2', nome: 'Poupança', saldo: 0, tipo: 'poupanca', initialByMonth: {} },
      { id: '3', nome: 'Carteira', saldo: 0, tipo: 'carteira', initialByMonth: {} },
    ],
    categorias: [
      { id: '1', nome: 'Trabalho' },
      { id: '2', nome: 'Freelance' },
      { id: '3', nome: 'Investimentos' },
      { id: '4', nome: 'Outros' },
      { id: '5', nome: 'Moradia' },
      { id: '6', nome: 'Alimentação' },
      { id: '7', nome: 'Transporte' },
      { id: '8', nome: 'Saúde' },
      { id: '9', nome: 'Educação' },
      { id: '10', nome: 'Lazer' },
      { id: '11', nome: 'Utilidades' },
      { id: '12', nome: 'Compras' },
      { id: '13', nome: 'Seguros' },
      { id: '14', nome: 'Financeiro' },
    ],
    receitasPrevistas: [
      { 
        id: '1', 
        descricao: 'Salário Principal', 
        valor: 0, 
        recebido: false, 
        dataVencimento: new Date().toISOString().split('T')[0],
        periodo: new Date().toISOString().slice(0, 7), // YYYY-MM
        diaVencimento: 5
      },
    ]
  };

  // Salvar caixas iniciais
  for (const caixa of initialData.caixas) {
    await setDoc(doc(db, 'users', userId, 'caixas', caixa.id), caixa);
  }

  // Salvar categorias iniciais
  for (const categoria of initialData.categorias) {
    await setDoc(doc(db, 'users', userId, 'categorias', categoria.id), categoria);
  }

  // Salvar receitas previstas iniciais na nova estrutura (subcoleção por período)
  for (const receita of initialData.receitasPrevistas) {
    if (receita.periodo) {
      await setDoc(doc(db, 'users', userId, 'receitasPrevistas', receita.periodo, 'receitas', receita.id), receita);
    }
  }
};

// Funções para Caixas
export const saveCaixa = async (userId: string, caixa: Caixa) => {
  await setDoc(doc(db, 'users', userId, 'caixas', caixa.id), caixa);
};

export const deleteCaixa = async (userId: string, caixaId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'caixas', caixaId));
};

export const subscribeToCaixas = (userId: string, callback: (caixas: Caixa[]) => void) => {
  const q = query(collection(db, 'users', userId, 'caixas'));
  return onSnapshot(q, (snapshot) => {
    const caixas: Caixa[] = [];
    snapshot.forEach((doc) => {
      caixas.push({ id: doc.id, ...doc.data() } as Caixa);
    });
    callback(caixas);
  });
};

// Funções para Transações
export const saveTransacao = async (userId: string, transacao: Transacao) => {
  await setDoc(doc(db, 'users', userId, 'transacoes', transacao.id), {
    ...transacao,
    createdAt: Timestamp.fromDate(new Date())
  });
};

export const deleteTransacao = async (userId: string, transacaoId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'transacoes', transacaoId));
};

export const subscribeToTransacoes = (userId: string, callback: (transacoes: Transacao[]) => void) => {
  const q = query(
    collection(db, 'users', userId, 'transacoes'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const transacoes: Transacao[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      transacoes.push({ 
        id: doc.id, 
        ...data,
        // Remover createdAt do objeto final
        createdAt: undefined
      } as Transacao);
    });
    callback(transacoes);
  });
};

// =======================
// Gastos Fixos - Nova estrutura por período
// Estrutura: users/{userId}/gastosFixos/{periodo}/itens/{gastoId}
// =======================

// Migrar documento antigo (flat) para a nova estrutura por período
const migrateGastoToSubcollection = async (userId: string, gasto: GastoFixo) => {
  try {
    let periodo = (gasto as any).periodo as string | undefined;
    if (!periodo) {
      const today = new Date();
      periodo = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
    const migrado: GastoFixo = { ...(gasto as any), periodo } as any;
    await setDoc(doc(db, 'users', userId, 'gastosFixos', periodo, 'itens', migrado.id), migrado);
    try { await deleteDoc(doc(db, 'users', userId, 'gastosFixos', (gasto as any).id)); } catch {}
  } catch (e) {
    console.error('Erro ao migrar gasto fixo:', (gasto as any)?.id, e);
  }
};

export const saveGastoFixo = async (userId: string, gastoFixo: GastoFixo) => {
  const periodo = (gastoFixo as any).periodo as string | undefined;
  if (!periodo) throw new Error('Gasto Fixo deve ter período definido');
  const sanitizado: any = { ...gastoFixo };
  Object.keys(sanitizado).forEach((k) => { if (sanitizado[k] === undefined) delete sanitizado[k]; });
  await setDoc(doc(db, 'users', userId, 'gastosFixos', periodo, 'itens', gastoFixo.id), sanitizado);
};

export const deleteGastoFixo = async (userId: string, gastoFixoId: string, periodo?: string) => {
  if (periodo) {
    await deleteDoc(doc(db, 'users', userId, 'gastosFixos', periodo, 'itens', gastoFixoId));
    return;
  }
  const now = new Date();
  const tasks: Promise<void>[] = [];
  for (let i = -12; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    tasks.push(
      deleteDoc(doc(db, 'users', userId, 'gastosFixos', ym, 'itens', gastoFixoId)).catch(() => undefined)
    );
  }
  await Promise.all(tasks);
};

export const subscribeToGastosFixos = (userId: string, callback: (gastosFixos: GastoFixo[]) => void) => {
  const unsubscribers: Array<() => void> = [];
  const porPeriodo = new Map<string, GastoFixo[]>();

  const emitir = () => {
    const all: GastoFixo[] = [];
    porPeriodo.forEach((arr) => all.push(...arr));
    callback(all);
  };

  const now = new Date();
  const periods: string[] = [];
  for (let i = -12; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  periods.forEach((p) => {
    const q = query(collection(db, 'users', userId, 'gastosFixos', p, 'itens'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: GastoFixo[] = [];
      snap.forEach((docSnap) => arr.push({ id: docSnap.id, ...docSnap.data() } as GastoFixo));
      porPeriodo.set(p, arr);
      emitir();
    });
    unsubscribers.push(unsub);
  });

  // Listener para coleção antiga (flat) para migração automática
  const oldQ = query(collection(db, 'users', userId, 'gastosFixos'));
  const oldUnsub = onSnapshot(oldQ, async (snapshot) => {
    const jobs: Promise<void>[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as any;
      if (data && data.descricao && data.valor != null) {
        const gasto: GastoFixo = { id: d.id, ...data } as any;
        jobs.push(migrateGastoToSubcollection(userId, gasto));
      }
    });
    if (jobs.length) await Promise.all(jobs).catch(console.error);
  });
  unsubscribers.push(oldUnsub);

  return () => unsubscribers.forEach((u) => u());
};

// Migração manual: mover todos os documentos flat de gastosFixos para um período alvo
export const migrateAllGastosFlatToPeriod = async (userId: string, targetPeriod: string) => {
  const oldCol = collection(db, 'users', userId, 'gastosFixos');
  const snap = await getDocs(oldCol);
  const jobs: Promise<void>[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    // ignorar nós que já são meses (quando id parece YYYY-MM)
    if (/^\d{4}-\d{2}$/.test(d.id)) return;
    if (data && data.descricao && data.valor != null) {
      const g: any = { id: d.id, ...data, periodo: targetPeriod };
      jobs.push(setDoc(doc(db, 'users', userId, 'gastosFixos', targetPeriod, 'itens', g.id), g));
      jobs.push(deleteDoc(doc(db, 'users', userId, 'gastosFixos', d.id)).catch(() => {} as any) as any);
    }
  });
  if (jobs.length) await Promise.all(jobs);
};

// Funções para Dívidas
export const saveDivida = async (userId: string, divida: Divida) => {
  await setDoc(doc(db, 'users', userId, 'dividas', divida.id), divida);
};

export const deleteDivida = async (userId: string, dividaId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'dividas', dividaId));
};

export const subscribeToDividas = (userId: string, callback: (dividas: Divida[]) => void) => {
  const q = query(collection(db, 'users', userId, 'dividas'));
  return onSnapshot(q, (snapshot) => {
    const dividas: Divida[] = [];
    snapshot.forEach((doc) => {
      dividas.push({ id: doc.id, ...doc.data() } as Divida);
    });
    callback(dividas);
  });
};

// Funções para Cofrinhos
export const saveCofrinho = async (userId: string, cofrinho: Cofrinho) => {
  await setDoc(doc(db, 'users', userId, 'cofrinhos', cofrinho.id), cofrinho);
};

export const deleteCofrinho = async (userId: string, cofrinhoId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'cofrinhos', cofrinhoId));
};

export const subscribeToCofrinhos = (userId: string, callback: (cofrinhos: Cofrinho[]) => void) => {
  const q = query(collection(db, 'users', userId, 'cofrinhos'));
  return onSnapshot(q, (snapshot) => {
    const cofrinhos: Cofrinho[] = [];
    snapshot.forEach((doc) => {
      cofrinhos.push({ id: doc.id, ...doc.data() } as Cofrinho);
    });
    callback(cofrinhos);
  });
};

// Funções para Categorias
export const saveCategoria = async (userId: string, categoria: Categoria) => {
  await setDoc(doc(db, 'users', userId, 'categorias', categoria.id), categoria);
};

export const deleteCategoria = async (userId: string, categoriaId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'categorias', categoriaId));
};

export const subscribeToCategorias = (userId: string, callback: (categorias: Categoria[]) => void) => {
  const q = query(collection(db, 'users', userId, 'categorias'));
  return onSnapshot(q, (snapshot) => {
    const categorias: Categoria[] = [];
    snapshot.forEach((doc) => {
      categorias.push({ id: doc.id, ...doc.data() } as Categoria);
    });
    callback(categorias);
  });
};

// Funções para Receitas Previstas - Nova estrutura por período
// Estrutura: users/{userId}/receitasPrevistas/{periodo}/receitas/{receitaId}
export const saveReceitaPrevista = async (userId: string, receita: ReceitaPrevista) => {
  // Validar que tem período
  if (!receita.periodo) {
    throw new Error('Receita deve ter período definido');
  }
  // Remover campos undefined (Firestore não aceita undefined)
  const receitaSanitizada: any = { ...receita };
  Object.keys(receitaSanitizada).forEach((key) => {
    if (receitaSanitizada[key] === undefined) {
      delete receitaSanitizada[key];
    }
  });
  await setDoc(doc(db, 'users', userId, 'receitasPrevistas', receita.periodo, 'receitas', receita.id), receitaSanitizada);
};

export const deleteReceitaPrevista = async (userId: string, receitaId: string, periodo?: string) => {
  if (!periodo) throw new Error('Período é obrigatório para deletar receita');
  await deleteDoc(doc(db, 'users', userId, 'receitasPrevistas', periodo, 'receitas', receitaId));
};

export const subscribeToReceitasPrevistas = (userId: string, callback: (receitas: ReceitaPrevista[]) => void) => {
  // Escutar múltiplos períodos (últimos 12 e próximos 12 meses) nas subcoleções "receitas"
  const unsubscribers: Array<() => void> = [];
  const receitasPorPeriodo = new Map<string, ReceitaPrevista[]>();

  const emitir = () => {
    const todas: ReceitaPrevista[] = [];
    receitasPorPeriodo.forEach(rs => todas.push(...rs));
    callback(todas);
  };

  const now = new Date();
  const periodsToCheck: string[] = [];
  for (let i = -12; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    periodsToCheck.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  periodsToCheck.forEach(periodo => {
    const q = query(collection(db, 'users', userId, 'receitasPrevistas', periodo, 'receitas'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: ReceitaPrevista[] = [];
      snap.forEach(docSnap => arr.push({ id: docSnap.id, ...docSnap.data() } as ReceitaPrevista));
      receitasPorPeriodo.set(periodo, arr);
      emitir();
    });
    unsubscribers.push(unsub);
  });

  // Também migrar documentos soltos (estrutura antiga)
  // Isso inclui documentos com formato antigo (ID direto) e formato intermediário (periodo-id)
  const oldQ = query(collection(db, 'users', userId, 'receitasPrevistas'));
  const oldUnsub = onSnapshot(oldQ, async (snapshot) => {
    const jobs: Promise<void>[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as any;
      const docId = d.id;
      
      // Verificar se é um documento de receita (tem descricao) e não é uma subcoleção de período
      // Subcoleções de período são documentos que têm apenas formato YYYY-MM (sem descricao)
      if (data && data.descricao) {
        // Extrair ID real da receita se o docId inclui período (formato antigo intermediário)
        let receitaId = docId;
        let periodoDoId = null;
        
        // Se o ID começa com período (YYYY-MM-...), extrair
        if (/^\d{4}-\d{2}-/.test(docId)) {
          const partes = docId.split('-');
          periodoDoId = `${partes[0]}-${partes[1]}`;
          receitaId = partes.slice(2).join('-') || docId; // ID real da receita
        }
        
        // Usar período do campo data.periodo, ou período extraído do ID, ou calcular de dataVencimento
        const periodo = data.periodo || periodoDoId;
        const receita: ReceitaPrevista = {
          id: receitaId, // ID limpo sem período
          ...data,
          periodo: periodo, // Garantir que tem período
        };
        
        jobs.push(migrateReceitaToSubcollection(userId, receita));
      }
    });
    if (jobs.length) {
      await Promise.all(jobs).catch(console.error);
    }
  });
  unsubscribers.push(oldUnsub);

  return () => unsubscribers.forEach(u => u());
};

// Função de migração: mover receita da coleção antiga para subcoleção por período
const migrateReceitaToSubcollection = async (userId: string, receita: ReceitaPrevista) => {
  try {
    // Determinar período da receita
    let periodo = receita.periodo;
    if (!periodo && receita.dataVencimento) {
      const dataVenc = new Date(receita.dataVencimento + 'T00:00:00');
      periodo = `${dataVenc.getFullYear()}-${String(dataVenc.getMonth() + 1).padStart(2, '0')}`;
    }
    
    if (!periodo) {
      console.warn('Não foi possível determinar período para receita:', receita.id);
      return;
    }
    
    // Garantir que tem diaVencimento
    if (!receita.diaVencimento && receita.dataVencimento) {
      const dataVenc = new Date(receita.dataVencimento + 'T00:00:00');
      receita.diaVencimento = dataVenc.getDate();
    }
    
    // Garantir que o ID da receita não inclui período (limpar se necessário)
    const receitaIdLimpo = receita.id.replace(/^\d{4}-\d{2}-/, '') || receita.id;
    
    // Criar receita atualizada com período e salvar na subcoleção do mês
    const receitaMigrada: ReceitaPrevista = { 
      ...receita, 
      id: receitaIdLimpo, // ID limpo sem período
      periodo 
    };
    
    await setDoc(doc(db, 'users', userId, 'receitasPrevistas', periodo, 'receitas', receitaIdLimpo), receitaMigrada);

    // Deletar da estrutura antiga - tentar tanto com ID original quanto com ID+período
    const idsParaDeletar = [
      receita.id, // ID original (pode incluir período ou não)
      receitaIdLimpo, // ID limpo
      `${periodo}-${receitaIdLimpo}`, // Formato periodo-id (caso tenha sido salvo assim antes)
    ];
    
    for (const idParaDeletar of idsParaDeletar) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'receitasPrevistas', idParaDeletar));
        console.log('Receita migrada:', idParaDeletar, '->', periodo, '/receitas/', receitaIdLimpo);
      } catch (e) {
        // Ignorar erro se já não existir
      }
    }
  } catch (error) {
    console.error('Erro ao migrar receita:', receita.id, error);
  }
};

// Migração pontual: mover todas receitas de um período para outro
export const moveReceitasBetweenPeriods = async (
  userId: string,
  fromPeriod: string,
  toPeriod: string
) => {
  try {
    const fromCol = collection(db, 'users', userId, 'receitasPrevistas', fromPeriod, 'receitas');
    const fromSnap = await (await import('firebase/firestore')).getDocs(fromCol as any);
    const batchJobs: Promise<void>[] = [];
    fromSnap.forEach((docSnap: any) => {
      const data = docSnap.data() as ReceitaPrevista;
      const id = docSnap.id;
      const receitaAtualizada: ReceitaPrevista = { ...data, periodo: toPeriod };
      // escrever no destino e apagar origem
      batchJobs.push(setDoc(doc(db, 'users', userId, 'receitasPrevistas', toPeriod, 'receitas', id), receitaAtualizada));
      batchJobs.push(deleteDoc(doc(db, 'users', userId, 'receitasPrevistas', fromPeriod, 'receitas', id)));
    });
    if (batchJobs.length > 0) {
      await Promise.all(batchJobs);
      console.log(`Receitas movidas de ${fromPeriod} para ${toPeriod}:`, batchJobs.length / 2);
    }
  } catch (e) {
    console.error('Erro ao mover receitas entre períodos:', fromPeriod, '->', toPeriod, e);
    throw e;
  }
};

// Replicação idempotente: cria receitas de (mês anterior) em (targetPeriod) apenas 1x
export const replicateReceitasIfNeeded = async (userId: string, targetPeriod: string) => {
  // Doc meta para marcar que já replicou uma vez
  const metaRef = doc(db, 'users', userId, 'receitasPrevistasMeta', targetPeriod);
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) {
    return; // já replicado para este mês
  }
  // Determinar mês anterior
  const [y, m] = targetPeriod.split('-').map(Number);
  const prev = new Date(y, (m - 1) - 1, 1);
  const prevPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  // Ler receitas atuais e do mês anterior
  const [currSnap, prevSnap] = await Promise.all([
    getDocs(collection(db, 'users', userId, 'receitasPrevistas', targetPeriod, 'receitas')),
    getDocs(collection(db, 'users', userId, 'receitasPrevistas', prevPeriod, 'receitas')),
  ]);

  // Mapas por descrição para evitar duplicar
  const existentes = new Set<string>();
  currSnap.forEach(d => existentes.add((d.data() as any).descricao));

  const jobs: Promise<void>[] = [];
  prevSnap.forEach(d => {
    const r = d.data() as ReceitaPrevista;
    if (!existentes.has(r.descricao)) {
      const dia = r.diaVencimento || (r.dataVencimento ? new Date(r.dataVencimento + 'T00:00:00').getDate() : 1);
      const dt = new Date(y, (m - 1), dia);
      const nova: ReceitaPrevista = {
        ...r,
        id: r.id, // mantém o mesmo id base
        periodo: targetPeriod,
        recebido: false,
        dataVencimento: dt.toISOString().split('T')[0],
      };
      jobs.push(setDoc(doc(db, 'users', userId, 'receitasPrevistas', targetPeriod, 'receitas', nova.id), nova));
    }
  });

  if (jobs.length > 0) {
    await Promise.all(jobs);
  }
  // Marcar como replicado (mesmo que não tenha criado nada, evita recriar após exclusões)
  await setDoc(metaRef, { replicatedAt: Timestamp.fromDate(new Date()), from: prevPeriod });
};

// Replicação idempotente para Gastos Fixos: replica itens do mês anterior para o mês alvo
export const replicateGastosIfNeeded = async (userId: string, targetPeriod: string) => {
  // Meta: users/{uid}/gastosFixosMeta/{YYYY-MM}
  const metaRef = doc(db, 'users', userId, 'gastosFixosMeta', targetPeriod);
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) return; // já replicado

  const [y, m] = targetPeriod.split('-').map(Number);
  const prev = new Date(y, (m - 1) - 1, 1);
  const prevPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const [currSnap, prevSnap] = await Promise.all([
    getDocs(collection(db, 'users', userId, 'gastosFixos', targetPeriod, 'itens')),
    getDocs(collection(db, 'users', userId, 'gastosFixos', prevPeriod, 'itens')),
  ]);

  // Evitar duplicação por descrição+categoria+diaVencimento (chave comum)
  const chave = (g: any) => `${g.descricao}||${g.categoria}||${g.diaVencimento}`;
  const existentes = new Set<string>();
  currSnap.forEach((d) => existentes.add(chave(d.data())));

  const jobs: Promise<void>[] = [];
  prevSnap.forEach((d) => {
    const g = d.data() as GastoFixo;
    const k = chave(g);
    if (!existentes.has(k)) {
      const novo: GastoFixo = {
        ...g,
        id: g.id, // manter mesmo id base por item recorrente
        pago: false,
        valorPago: 0,
        pagamentos: [],
        periodo: targetPeriod,
      } as any;
      jobs.push(setDoc(doc(db, 'users', userId, 'gastosFixos', targetPeriod, 'itens', novo.id), novo));
    }
  });

  if (jobs.length) await Promise.all(jobs);
  await setDoc(metaRef, { replicatedAt: Timestamp.fromDate(new Date()), from: prevPeriod });
};

// =======================
// Cartões de Crédito
// =======================

export const saveCreditCard = async (userId: string, card: CartaoCredito) => {
  await setDoc(doc(db, 'users', userId, 'creditCards', card.id), card);
};

export const deleteCreditCard = async (userId: string, cardId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'creditCards', cardId));
};

export const subscribeToCreditCards = (userId: string, callback: (cards: CartaoCredito[]) => void) => {
  const q = query(collection(db, 'users', userId, 'creditCards'));
  return onSnapshot(q, (snapshot) => {
    const cards: CartaoCredito[] = [];
    snapshot.forEach((doc) => cards.push({ id: doc.id, ...doc.data() } as CartaoCredito));
    callback(cards);
  });
};

// Compras de Cartão (flat por usuário; relaciona por cardId)
export const saveCreditCardPurchase = async (userId: string, purchase: CompraCartao) => {
  await setDoc(doc(db, 'users', userId, 'creditCardPurchases', purchase.id), purchase);
};

export const deleteCreditCardPurchase = async (userId: string, purchaseId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'creditCardPurchases', purchaseId));
};

export const subscribeToCreditCardPurchases = (userId: string, callback: (purchases: CompraCartao[]) => void) => {
  const q = query(collection(db, 'users', userId, 'creditCardPurchases'));
  return onSnapshot(q, (snapshot) => {
    const purchases: CompraCartao[] = [];
    snapshot.forEach((doc) => purchases.push({ id: doc.id, ...doc.data() } as CompraCartao));
    callback(purchases);
  });
};
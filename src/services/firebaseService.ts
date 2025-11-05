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

// =======================
// Transações - Nova estrutura por período
// Estrutura: users/{userId}/transacoes/{periodo}/itens/{transacaoId}
// =======================

// Migrar transação antiga (flat) para a subcoleção do período
const migrateTransacaoToSubcollection = async (userId: string, t: Transacao) => {
  try {
    const data = t.data || '';
    const d = new Date(data + 'T00:00:00');
    const periodo = isNaN(d.getTime())
      ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const migrada: any = { ...t, periodo };
    await setDoc(doc(db, 'users', userId, 'transacoes', periodo, 'itens', t.id), migrada);
    try { await deleteDoc(doc(db, 'users', userId, 'transacoes', (t as any).id)); } catch {}
  } catch {}
};

export const saveTransacao = async (userId: string, transacao: Transacao) => {
  const d = new Date(transacao.data + 'T00:00:00');
  const periodo = isNaN(d.getTime())
    ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const payload: any = { ...transacao, periodo };
  Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
  await setDoc(doc(db, 'users', userId, 'transacoes', periodo, 'itens', transacao.id), payload);
};

export const deleteTransacao = async (userId: string, transacaoId: string, periodo?: string) => {
  if (periodo) {
    await deleteDoc(doc(db, 'users', userId, 'transacoes', periodo, 'itens', transacaoId));
    return;
  }
  const now = new Date();
  const tasks: Promise<void>[] = [];
  for (let i = -12; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    tasks.push(deleteDoc(doc(db, 'users', userId, 'transacoes', ym, 'itens', transacaoId)).catch(() => undefined));
  }
  await Promise.all(tasks);
};

export const subscribeToTransacoes = (userId: string, callback: (transacoes: Transacao[]) => void) => {
  const unsubscribers: Array<() => void> = [];
  const porPeriodo = new Map<string, Transacao[]>();
  const emitir = () => {
    const all: Transacao[] = [];
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
    const q = query(collection(db, 'users', userId, 'transacoes', p, 'itens'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Transacao[] = [];
      snap.forEach((docSnap) => arr.push({ id: docSnap.id, ...docSnap.data() } as Transacao));
      porPeriodo.set(p, arr);
      emitir();
    });
    unsubscribers.push(unsub);
  });
  // migrar coleção antiga flat
  const oldQ = query(collection(db, 'users', userId, 'transacoes'));
  const oldUnsub = onSnapshot(oldQ, async (snapshot) => {
    const jobs: Promise<void>[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as any;
      if (data && data.data && data.tipo && data.valor != null) {
        const t: Transacao = { id: d.id, ...data } as any;
        jobs.push(migrateTransacaoToSubcollection(userId, t));
      }
    });
    if (jobs.length) await Promise.all(jobs).catch(() => {});
  });
  unsubscribers.push(oldUnsub);
  return () => unsubscribers.forEach((u) => u());
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
  } catch (_e) {
    console.error('Erro ao migrar gasto fixo');
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

// Duplicar gastos fixos de um período para outro (sem pagamentos)
export const duplicateGastosFromPeriod = async (userId: string, fromPeriod: string, toPeriod: string) => {
  try {
    const fromCol = collection(db, 'users', userId, 'gastosFixos', fromPeriod, 'itens');
    const fromSnap = await getDocs(fromCol);
    
    if (fromSnap.empty) {
      throw new Error(`Nenhum gasto fixo encontrado no período ${fromPeriod}`);
    }
    
    const jobs: Promise<void>[] = [];
    
    fromSnap.forEach((d) => {
      const data = d.data() as any;
      if (data && data.descricao && data.valor != null) {
        // Calcular nova data de vencimento para o mês destino
        const [toYear, toMonth] = toPeriod.split('-').map(Number);
        
        let newDataVencimento = data.dataVencimento;
        if (data.dataVencimento) {
          try {
            const dataVenc = new Date(data.dataVencimento + 'T00:00:00');
            if (!isNaN(dataVenc.getTime())) {
              const diaVenc = dataVenc.getDate();
              const newDate = new Date(toYear, toMonth - 1, Math.min(diaVenc, new Date(toYear, toMonth, 0).getDate()));
              newDataVencimento = newDate.toISOString().split('T')[0];
            }
          } catch {}
        }
        
        // Gerar novo ID único para o gasto duplicado
        const novoId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) 
          ? (crypto as any).randomUUID() 
          : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Criar novo gasto com todos os dados originais, exceto id, periodo, pago e valorPago
        const novoGasto: any = {
          ...data,
          id: novoId, // NOVO ID
          periodo: toPeriod, // NOVO PERÍODO
          dataVencimento: newDataVencimento || data.dataVencimento, // Data atualizada
          valorPago: 0, // Sem pagamentos
          pago: false, // Sempre false
        };
        
        // Limpar pagamentos se existirem
        if (novoGasto.pagamentos) {
          delete novoGasto.pagamentos;
        }
        
        // Limpar campos undefined
        Object.keys(novoGasto).forEach((k) => { if (novoGasto[k] === undefined) delete novoGasto[k]; });
        
        // Salvar com o novo ID no período destino
        jobs.push(setDoc(doc(db, 'users', userId, 'gastosFixos', toPeriod, 'itens', novoId), novoGasto));
      }
    });
    
    if (jobs.length === 0) {
      throw new Error('Nenhum gasto fixo válido encontrado para duplicar');
    }
    
    await Promise.all(jobs);
  } catch (error: any) {
    throw new Error(`Erro ao duplicar gastos: ${error?.message || 'Erro desconhecido'}`);
  }
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
      jobs.push(
        deleteDoc(doc(db, 'users', userId, 'gastosFixos', d.id)).catch(() => undefined)
      );
    }
  });
  if (jobs.length) await Promise.all(jobs);
};

// =======================
// Dívidas - Estrutura por período
// Estrutura: users/{userId}/dividas/{periodo}/itens/{dividaId} ou {dividaId}-{n} para parceladas
// Cada parcela vai para o mês do seu vencimento
// =======================

// Migrar dívida antiga (flat) para subcoleção por período
const migrateDividaToSubcollection = async (userId: string, divida: Divida) => {
  try {
    const dataVenc = new Date(divida.dataVencimento + 'T00:00:00');
    if (isNaN(dataVenc.getTime())) return;
    
    // Para dívidas parceladas, cada parcela vai para o mês correspondente
    if (divida.tipo === 'parcelada' && divida.parcelas > 1) {
      const parcelas = divida.parcelas || 1;
      const valorParcela = divida.valorParcela || (divida.valorTotal / parcelas);
      const jobs: Promise<void>[] = [];
      
      // Para dívidas distribuídas, manter parcelasPagas com o TOTAL de parcelas pagas (não apenas 1 ou 0)
      const totalParcelasPagas = divida.parcelasPagas || 0;
      
      for (let i = 0; i < parcelas; i++) {
        // Criar data da parcela adicionando i meses
        const dataParcela = new Date(dataVenc);
        dataParcela.setMonth(dataParcela.getMonth() + i);
        // getMonth() retorna 0-11, então adicionamos 1 para obter 1-12
        const periodo = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, '0')}`;
        const parcelaId = `${divida.id}-${i + 1}`;
        const parcelaPaga = i < totalParcelasPagas;
        
        const item = {
          ...divida,
          id: parcelaId,
          parcelaIndex: i + 1,
          parcelaTotal: parcelas,
          valorTotal: valorParcela, // valor desta parcela
          valorPago: parcelaPaga ? valorParcela : 0,
          parcelasPagas: totalParcelasPagas, // Manter o TOTAL de parcelas pagas em todas as parcelas
          dataVencimento: dataParcela.toISOString().split('T')[0],
          periodo,
        } as any;
        
        Object.keys(item).forEach((k) => { if (item[k] === undefined) delete item[k]; });
        jobs.push(setDoc(doc(db, 'users', userId, 'dividas', periodo, 'itens', parcelaId), item));
      }
      
      if (jobs.length) await Promise.all(jobs);
    } else {
      // Dívida à vista ou total
      const periodo = `${dataVenc.getFullYear()}-${String(dataVenc.getMonth() + 1).padStart(2, '0')}`;
      const migrado: any = { ...divida, periodo };
      Object.keys(migrado).forEach((k) => { if (migrado[k] === undefined) delete migrado[k]; });
      await setDoc(doc(db, 'users', userId, 'dividas', periodo, 'itens', migrado.id), migrado);
    }
    
    // Apagar doc antigo
    try { await deleteDoc(doc(db, 'users', userId, 'dividas', divida.id)); } catch {}
  } catch {}
};

export const saveDivida = async (userId: string, divida: Divida) => {
  const dataVenc = new Date(divida.dataVencimento + 'T00:00:00');
  if (isNaN(dataVenc.getTime())) throw new Error('Data de vencimento inválida');
  
  // Determinar competência inicial: usar a escolhida pelo usuário ou calcular pela data de vencimento
  let competenciaInicial = (divida as any).competenciaInicial;
  if (!competenciaInicial) {
    // Se não foi especificada, usar a data de vencimento
    competenciaInicial = `${dataVenc.getFullYear()}-${String(dataVenc.getMonth() + 1).padStart(2, '0')}`;
  }
  
  const [anoCompetencia, mesCompetencia] = competenciaInicial.split('-').map(Number);
  
  // Para dívidas parceladas, cada parcela vai para o mês correspondente
  if (divida.tipo === 'parcelada' && divida.parcelas > 1) {
    const parcelas = divida.parcelas || 1;
    const valorParcela = divida.valorParcela || (divida.valorTotal / parcelas);
    const jobs: Promise<void>[] = [];
    
    // Determinar debtId (chave de agrupamento) para identificar parcelas relacionadas
    let debtId: string;
    if ((divida as any).debtId) {
      debtId = (divida as any).debtId;
    } else {
      // Tentar extrair ID base removendo sufixo numérico de parcelaIndex
      const partes = divida.id.split('-');
      const ultimo = partes[partes.length - 1];
      if (/^\d+$/.test(ultimo) && partes.length > 1) {
        const possivelParcelaIndex = parseInt(ultimo);
        if (possivelParcelaIndex >= 1 && possivelParcelaIndex <= parcelas) {
          debtId = partes.slice(0, -1).join('-');
        } else {
          debtId = divida.id;
        }
      } else {
        debtId = divida.id;
      }
    }
    const idBase = debtId;
    
    // Para dívidas distribuídas, manter parcelasPagas com o TOTAL de parcelas pagas (não apenas 1 ou 0)
    const totalParcelasPagas = divida.parcelasPagas || 0;
    
    // Determinar a parcela inicial:
    // - Se está editando uma parcela existente (parcelaIndex definido), começar dali
    // - Se é dívida nova em andamento (parcelasPagas > 0), começar da parcela atual (parcelasPagas + 1)
    // - Caso contrário, começar da parcela 1
    let parcelaInicial = 1;
    if (divida.parcelaIndex !== undefined) {
      // Editando parcela existente: criar/atualizar a partir desta
      parcelaInicial = divida.parcelaIndex;
    } else if (totalParcelasPagas > 0) {
      // Dívida nova em andamento: começar da parcela atual (parcelasPagas + 1)
      // Se parcelasPagas = 2, significa que parcelas 1-2 foram pagas, então começar da parcela 3
      parcelaInicial = totalParcelasPagas + 1;
    }
    
    // Busca e limpeza: encontrar parcelas relacionadas antes de criar novas
    const now = new Date();
    const parcelasParaDeletar = new Map<string, { periodo: string; docId: string }>();
    const periodosParaVerificar: string[] = [];
    for (let offset = -12; offset <= 12; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      periodosParaVerificar.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    
    // Características semânticas para busca de fallback
    const descNormalizada = divida.descricao.trim().toLowerCase();
    const valorTotalNormalizado = Math.round(divida.valorTotal * 100);
    
    // Buscar todas as parcelas relacionadas
    const buscaJobs = periodosParaVerificar.map(async (periodo) => {
      try {
        const colRef = collection(db, 'users', userId, 'dividas', periodo, 'itens');
        const snap = await getDocs(colRef);
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const docId = docSnap.id;
          let deveDeletar = false;
          
          // Método 1: Por debtId (mais confiável)
          if (data.debtId === debtId) {
            deveDeletar = true;
          }
          // Método 2: Por ID base (compatibilidade)
          else if (docId === idBase || docId.startsWith(`${idBase}-`)) {
            deveDeletar = true;
          }
          // Método 3: Por campo id interno
          else if (data.id === idBase || (data.id && data.id.startsWith(`${idBase}-`))) {
            deveDeletar = true;
          }
          // Método 4: Busca semântica (fallback para dados antigos)
          else if (
            data.tipo === 'parcelada' &&
            data.parcelas === parcelas &&
            data.descricao &&
            data.descricao.trim().toLowerCase() === descNormalizada &&
            Math.round(data.valorTotal * 100) === valorTotalNormalizado &&
            (data.parcelaIndex === undefined || data.parcelaIndex <= parcelas)
          ) {
            // É uma parcela da mesma dívida por características semânticas
            deveDeletar = true;
          }
          
          if (deveDeletar) {
            parcelasParaDeletar.set(`${periodo}/${docId}`, { periodo, docId });
          }
        });
      } catch (err) {
        // Ignorar erros (período pode não existir)
      }
    });
    
    await Promise.all(buscaJobs);
    
    // Deletar todas as parcelas encontradas
    const deleteJobs: Promise<void>[] = [];
    parcelasParaDeletar.forEach((info) => {
      const ref = doc(db, 'users', userId, 'dividas', info.periodo, 'itens', info.docId);
      deleteJobs.push(deleteDoc(ref).catch(() => {}));
    });
    
    // Aguardar TODAS as deleções completarem antes de criar novas parcelas
    await Promise.all(deleteJobs);
    for (let i = parcelaInicial - 1; i < parcelas; i++) {
      const parcelaIndex = i + 1; // Número real da parcela (3, 4, 5... se começando em 3)
      
      // Calcular período da parcela baseado na competência inicial
      // Parcela inicial sempre no mês da competência inicial (mesesAposInicial = 0)
      // Parcela seguinte = mesesAposInicial = 1, etc.
      const mesesAposInicial = parcelaIndex - parcelaInicial;
      
      let anoParcela = anoCompetencia;
      let mesParcela = mesCompetencia + mesesAposInicial;
      // Ajustar se passar de dezembro
      while (mesParcela > 12) {
        mesParcela -= 12;
        anoParcela++;
      }
      const periodo = `${anoParcela}-${String(mesParcela).padStart(2, '0')}`;
      
      // Criar data da parcela para vencimento (usar o dia da data de vencimento original)
      const diaVenc = dataVenc.getDate();
      const dataParcela = new Date(anoParcela, mesParcela - 1, Math.min(diaVenc, new Date(anoParcela, mesParcela, 0).getDate()));
      
      const parcelaId = `${idBase}-${parcelaIndex}`;
      
      // Verificar se já existe uma parcela com este ID para preservar valorPago
      let valorPagoParcela = 0;
      try {
        const parcelaExistente = await getDoc(doc(db, 'users', userId, 'dividas', periodo, 'itens', parcelaId));
        if (parcelaExistente.exists()) {
          const dataExistente = parcelaExistente.data();
          // Preservar valorPago da parcela existente se estiver sendo atualizada
          valorPagoParcela = (dataExistente as any).valorPago || 0;
        } else if (divida.valorPago && divida.parcelaIndex === parcelaIndex) {
          // Se a divida passada tem valorPago e é esta parcela, usar o valor
          valorPagoParcela = divida.valorPago;
        }
      } catch {}
      
      // Criar item com debtId para agrupamento e ID determinístico
      const item: any = {
        id: parcelaId,
        debtId: debtId,  // NOVO: Chave de agrupamento
        descricao: divida.descricao,
        valorTotal: divida.valorTotal,  // Valor total da dívida inteira
        valorParcela: valorParcela,  // Valor desta parcela específica
        valorPago: valorPagoParcela,  // Preservar valorPago se existir, senão 0
        parcelas: parcelas,
        parcelaIndex: parcelaIndex,  // Parcela real: 3, 4, 5... (se começando em 3)
        parcelaTotal: parcelas,
        parcelasPagas: divida.parcelasPagas || 0,  // Manter total de parcelas pagas
        tipo: divida.tipo,
        categoria: divida.categoria || 'Esporádicos',
        dataVencimento: dataParcela.toISOString().split('T')[0],
        periodo,
      };
      
      // Remover campos temporários
      delete item.competenciaInicial;
      Object.keys(item).forEach((k) => { if (item[k] === undefined) delete item[k]; });
      jobs.push(setDoc(doc(db, 'users', userId, 'dividas', periodo, 'itens', parcelaId), item));
    }
    
    await Promise.all(jobs);
  } else {
    // Dívida à vista ou total - usar a competência escolhida
    const payload: any = { ...divida, periodo: competenciaInicial };
    delete payload.competenciaInicial;
    Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
    await setDoc(doc(db, 'users', userId, 'dividas', competenciaInicial, 'itens', divida.id), payload);
  }
};

export const deleteDivida = async (userId: string, dividaId: string, periodo?: string) => {
  if (periodo) {
    // Deletar parcela específica ou dívida à vista do período
    await deleteDoc(doc(db, 'users', userId, 'dividas', periodo, 'itens', dividaId));
    // Se for parcela, pode haver outras no mesmo período ou em outros; não apagar todas automaticamente
    return;
  }
  
  // Sem período: buscar e deletar em todos os meses possíveis (últimos 24 meses)
  const now = new Date();
  const tasks: Promise<void>[] = [];
  for (let i = -12; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // Deletar a dívida principal e todas as parcelas (prefixo dividaId-)
    const q = query(collection(db, 'users', userId, 'dividas', ym, 'itens'));
    getDocs(q).then((snap) => {
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.id === dividaId || data.id?.startsWith(`${dividaId}-`) || data.id === `${dividaId}-1`) {
          tasks.push(deleteDoc(docSnap.ref).catch(() => undefined));
        }
      });
    }).catch(() => {});
  }
  if (tasks.length) await Promise.all(tasks);
};

export const subscribeToDividas = (userId: string, callback: (dividas: Divida[]) => void) => {
  const unsubscribers: Array<() => void> = [];
  const porPeriodo = new Map<string, Divida[]>();
  
  const emitir = () => {
    const all: Divida[] = [];
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
    const q = query(collection(db, 'users', userId, 'dividas', p, 'itens'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Divida[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        arr.push({ id: docSnap.id, ...data } as Divida);
      });
      // Log apenas se houver mudanças significativas ou duplicatas suspeitas
      if (arr.length > 0) {
        const parceladas = arr.filter(d => d.parcelaIndex !== undefined && d.parcelaTotal !== undefined);
        if (parceladas.length > 0) {
          // Verificar se há múltiplas parcelas da mesma dívida no mesmo período (possível duplicata)
          const porIdBase = new Map<string, number>();
          parceladas.forEach(d => {
            const partes = d.id.split('-');
            const ultimo = partes[partes.length - 1];
            if (/^\d+$/.test(ultimo) && partes.length > 1) {
              const idBase = partes.slice(0, -1).join('-');
              porIdBase.set(idBase, (porIdBase.get(idBase) || 0) + 1);
            }
          });
          // Verificação silenciosa - duplicatas serão tratadas na deduplicação do cliente
        }
      }
      porPeriodo.set(p, arr);
      emitir();
    }, (error) => {
      // Erro silencioso - período pode não existir ainda
    });
    unsubscribers.push(unsub);
  });
  
  // Listener para coleção antiga (flat) para migração automática
  // IMPORTANTE: Só migrar documentos que realmente estão na estrutura antiga
  // Ignorar documentos que são pastas de período (formato YYYY-MM)
  // DESABILITADO TEMPORARIAMENTE para evitar conflitos com saveDivida
  // A migração deve ser manual ou controlada de outra forma
  /*
  const oldQ = query(collection(db, 'users', userId, 'dividas'));
  const oldUnsub = onSnapshot(oldQ, async (snapshot) => {
    const jobs: Promise<void>[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as any;
      const docId = d.id;
      
      // Ignorar documentos que são pastas de período (formato YYYY-MM)
      if (/^\d{4}-\d{2}$/.test(docId)) {
        return; // É uma pasta de período, não uma dívida
      }
      
      // Heurística mais rigorosa: documentos antigos têm campos como descricao, valorTotal, parcelas
      // E NÃO têm período E NÃO têm parcelaIndex (indicando estrutura realmente antiga)
      // Se tiver parcelaIndex, já foi migrado ou está na estrutura nova
      if (data && data.descricao && data.valorTotal != null && !data.periodo && !data.parcelaIndex) {
        const divida: Divida = { id: d.id, ...data } as any;
        jobs.push(migrateDividaToSubcollection(userId, divida));
      }
    });
    if (jobs.length) await Promise.all(jobs).catch(() => {});
  });
  unsubscribers.push(oldUnsub);
  */
  
  return () => unsubscribers.forEach((u) => u());
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
      console.warn('Não foi possível determinar período para receita');
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
      } catch (e) {
        // Ignorar erro se já não existir
      }
    }
  } catch (error) {
    console.error('Erro ao migrar receita');
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
    }
  } catch (e) {
    console.error('Erro ao mover receitas entre períodos');
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

// =======================
// Compras de Cartão - Estrutura hierárquica
// Estrutura: users/{uid}/creditCards/{cardId}/compras/{purchaseId}
// =======================

// Migrar compra antiga (flat) para dentro do cartão
const migratePurchaseToCard = async (userId: string, purchase: CompraCartao) => {
  try {
    if (!purchase.cardId) return;
    const payload: any = { 
      ...purchase,
      valorPago: purchase.valorPago ?? 0 // Garantir que valorPago seja sempre definido
    };
    Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
    await setDoc(doc(db, 'users', userId, 'creditCards', purchase.cardId, 'compras', purchase.id), payload);
    // Apagar doc antigo
    try { await deleteDoc(doc(db, 'users', userId, 'creditCardPurchases', purchase.id)); } catch {}
  } catch {}
};

export const saveCreditCardPurchase = async (userId: string, purchase: CompraCartao) => {
  if (!purchase.cardId) throw new Error('Compra deve estar vinculada a um cartão');
  
  const payload: any = { 
    ...purchase,
    valorPago: purchase.valorPago ?? 0 // Garantir que valorPago seja sempre definido
  };
  Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
  await setDoc(doc(db, 'users', userId, 'creditCards', purchase.cardId, 'compras', purchase.id), payload);
  
  // Materializar parcelas por competência em faturas mensais do cartão
  try {
    await mirrorPurchaseToInvoices(userId, purchase);
  } catch {}
};

export const deleteCreditCardPurchase = async (userId: string, purchaseId: string, cardId?: string) => {
  if (cardId) {
    // Deletar direto se souber o cardId
    await deleteDoc(doc(db, 'users', userId, 'creditCards', cardId, 'compras', purchaseId));
    // Limpar itens de fatura relacionados
    const now = new Date();
    const tasks: Promise<void>[] = [];
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const q = query(collection(db, 'users', userId, 'creditCards', cardId, 'faturas', ym, 'itens'));
      getDocs(q).then((snap) => {
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.purchaseId === purchaseId || docSnap.id.startsWith(`${purchaseId}-`)) {
            tasks.push(deleteDoc(docSnap.ref).catch(() => undefined));
          }
        });
      }).catch(() => {});
    }
    if (tasks.length) await Promise.all(tasks);
    return;
  }
  
  // Sem cardId: buscar em todos os cartões
  const cardsCol = collection(db, 'users', userId, 'creditCards');
  const cardsSnap = await getDocs(cardsCol);
  const tasks: Promise<void>[] = [];
  cardsSnap.forEach((cardDoc) => {
    tasks.push(deleteDoc(doc(db, 'users', userId, 'creditCards', cardDoc.id, 'compras', purchaseId)).catch(() => undefined));
  });
  await Promise.all(tasks);
};

export const subscribeToCreditCardPurchases = (userId: string, callback: (purchases: CompraCartao[]) => void) => {
  const unsubscribers: Array<() => void> = [];
  const purchasesByCard = new Map<string, CompraCartao[]>();
  const cardListeners = new Map<string, () => void>();
  
  const emitir = () => {
    const all: CompraCartao[] = [];
    purchasesByCard.forEach((arr) => all.push(...arr));
    callback(all);
  };
  
  // Ouvir compras de todos os cartões
  const cardsCol = collection(db, 'users', userId, 'creditCards');
  const cardsUnsub = onSnapshot(cardsCol, (cardsSnap) => {
    const cardIds = new Set<string>();
    
    // Para cada cartão, assinar suas compras
    cardsSnap.forEach((cardDoc) => {
      const cardId = cardDoc.id;
      cardIds.add(cardId);
      
      // Só criar listener se não existir
      if (!cardListeners.has(cardId)) {
        const comprasCol = collection(db, 'users', userId, 'creditCards', cardId, 'compras');
        const comprasUnsub = onSnapshot(comprasCol, (comprasSnap) => {
          const compras: CompraCartao[] = [];
          comprasSnap.forEach((doc) => {
            const data = doc.data();
            // Garantir que valorPago seja inicializado como 0 se não existir
            compras.push({ 
              id: doc.id, 
              ...data,
              valorPago: data.valorPago ?? 0
            } as CompraCartao);
          });
          purchasesByCard.set(cardId, compras);
          emitir();
        });
        cardListeners.set(cardId, comprasUnsub);
        unsubscribers.push(comprasUnsub);
      }
    });
    
    // Remover listeners de cartões que não existem mais
    cardListeners.forEach((unsub, cardId) => {
      if (!cardIds.has(cardId)) {
        unsub();
        cardListeners.delete(cardId);
        purchasesByCard.delete(cardId);
      }
    });
    
    emitir();
  });
  unsubscribers.push(cardsUnsub);
  
  // Listener para coleção antiga (flat) para migração automática
  const oldQ = query(collection(db, 'users', userId, 'creditCardPurchases'));
  const oldUnsub = onSnapshot(oldQ, async (snapshot) => {
    const jobs: Promise<void>[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as any;
      if (data && data.cardId && data.descricao) {
        const purchase: CompraCartao = { 
          id: d.id, 
          ...data,
          valorPago: data.valorPago ?? 0 // Garantir que valorPago seja inicializado
        } as any;
        jobs.push(migratePurchaseToCard(userId, purchase));
      }
    });
    if (jobs.length) await Promise.all(jobs).catch(() => {});
  });
  unsubscribers.push(oldUnsub);
  
  return () => {
    cardListeners.forEach((unsub) => unsub());
    unsubscribers.forEach((u) => u());
  };
};

// =======================
// Cartões - Faturas por mês a partir das compras parceladas
// Estrutura: users/{uid}/creditCards/{cardId}/faturas/{YYYY-MM}/itens/{purchaseId}-{n}
// =======================
const mirrorPurchaseToInvoices = async (userId: string, purchase: CompraCartao) => {
  try {
    const first = purchase.startMonth || (purchase.dataCompra ? `${new Date(purchase.dataCompra).getFullYear()}-${String(new Date(purchase.dataCompra).getMonth() + 1).padStart(2, '0')}` : undefined);
    if (!first) return;
    const parcelas = Math.max(1, purchase.parcelas || 1);
    const valorParcela = purchase.valorParcela || (purchase.valorTotal / parcelas);
    const [y0, m0] = first.split('-').map(Number);
    let y = y0, m = m0;
    for (let n = 1; n <= parcelas; n++) {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const id = `${purchase.id}-${n}`;
      const item = {
        id,
        purchaseId: purchase.id,
        descricao: purchase.descricao,
        valor: valorParcela,
        parcela: n,
        parcelasTotais: parcelas,
        startMonth: first,
      } as any;
      await setDoc(doc(db, 'users', userId, 'creditCards', purchase.cardId, 'faturas', ym, 'itens', id), item);
      // avançar mês
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
  } catch {}
};

export const rebuildInvoicesForCard = async (userId: string, cardId: string) => {
  try {
    const qPurch = query(collection(db, 'users', userId, 'creditCardPurchases'));
    const snap = await getDocs(qPurch);
    const tasks: Promise<void>[] = [];
    snap.forEach((d) => {
      const p = d.data() as CompraCartao;
      if (p.cardId === cardId) tasks.push(mirrorPurchaseToInvoices(userId, p));
    });
    if (tasks.length) await Promise.all(tasks);
  } catch {}
};

// =======================
// Cofrinhos - Movimentos por mês (aportes/retiradas)
// Estrutura: users/{uid}/cofrinhos/{cofrinhoId}/movimentos/{YYYY-MM}/itens/{movId}
// =======================
export type CofrinhoMovimento = {
  id: string;
  tipo: 'aporte' | 'retirada';
  valor: number;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  periodo?: string; // YYYY-MM
};

export const saveCofrinhoMovimento = async (
  userId: string,
  cofrinhoId: string,
  movimento: CofrinhoMovimento
) => {
  const d = new Date(movimento.data + 'T00:00:00');
  const periodo = isNaN(d.getTime())
    ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const payload: any = { ...movimento, periodo };
  Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
  await setDoc(doc(db, 'users', userId, 'cofrinhos', cofrinhoId, 'movimentos', periodo, 'itens', movimento.id), payload);
};

export const subscribeCofrinhoMovimentos = (
  userId: string,
  cofrinhoId: string,
  periodo: string,
  callback: (movs: CofrinhoMovimento[]) => void
) => {
  const q = query(collection(db, 'users', userId, 'cofrinhos', cofrinhoId, 'movimentos', periodo, 'itens'));
  return onSnapshot(q, (snap) => {
    const arr: CofrinhoMovimento[] = [];
    snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) } as CofrinhoMovimento));
    callback(arr);
  });
};

// =======================
// Backup e Restauração de Dados
// =======================

export interface BackupData {
  version: string;
  exportDate: string;
  periodoInicio?: string;
  periodoFim?: string;
  userId?: string; // ID do usuário que exportou (opcional)
  caixas: Caixa[];
  transacoes: Transacao[];
  gastosFixos: GastoFixo[];
  dividas: Divida[];
  cofrinhos: Cofrinho[];
  categorias: Categoria[];
  receitasPrevistas: ReceitaPrevista[];
  cartoes: CartaoCredito[];
  comprasCartao: CompraCartao[];
}

// Exportar todos os dados do usuário
export const exportUserData = async (
  userId: string,
  options?: { periodoInicio?: string; periodoFim?: string; incluirTodos?: boolean }
): Promise<BackupData> => {
  const incluirTodos = options?.incluirTodos ?? false;
  const periodoInicio = options?.periodoInicio;
  const periodoFim = options?.periodoFim;

  const backup: BackupData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    periodoInicio,
    periodoFim,
    userId: incluirTodos ? userId : undefined,
    caixas: [],
    transacoes: [],
    gastosFixos: [],
    dividas: [],
    cofrinhos: [],
    categorias: [],
    receitasPrevistas: [],
    cartoes: [],
    comprasCartao: [],
  };

  // 1. Exportar Caixas
  const caixasSnap = await getDocs(collection(db, 'users', userId, 'caixas'));
  caixasSnap.forEach((doc) => {
    backup.caixas.push({ id: doc.id, ...doc.data() } as Caixa);
  });

  // 2. Exportar Transações
  const now = new Date();
  const periodsTransacoes: string[] = [];
  if (incluirTodos || (!periodoInicio && !periodoFim)) {
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      periodsTransacoes.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  } else if (periodoInicio && periodoFim) {
    const [anoInicio, mesInicio] = periodoInicio.split('-').map(Number);
    const [anoFim, mesFim] = periodoFim.split('-').map(Number);
    const startDate = new Date(anoInicio, mesInicio - 1, 1);
    const endDate = new Date(anoFim, mesFim, 0);
    let current = new Date(startDate);
    while (current <= endDate) {
      periodsTransacoes.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
  }

  for (const periodo of periodsTransacoes) {
    try {
      const transacoesSnap = await getDocs(collection(db, 'users', userId, 'transacoes', periodo, 'itens'));
      transacoesSnap.forEach((doc) => {
        backup.transacoes.push({ id: doc.id, ...doc.data() } as Transacao);
      });
    } catch {}
  }

  // 3. Exportar Gastos Fixos
  const periodsGastos: string[] = [];
  if (incluirTodos || (!periodoInicio && !periodoFim)) {
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      periodsGastos.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  } else if (periodoInicio && periodoFim) {
    const [anoInicio, mesInicio] = periodoInicio.split('-').map(Number);
    const [anoFim, mesFim] = periodoFim.split('-').map(Number);
    const startDate = new Date(anoInicio, mesInicio - 1, 1);
    const endDate = new Date(anoFim, mesFim, 0);
    let current = new Date(startDate);
    while (current <= endDate) {
      periodsGastos.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
  }

  for (const periodo of periodsGastos) {
    try {
      const gastosSnap = await getDocs(collection(db, 'users', userId, 'gastosFixos', periodo, 'itens'));
      gastosSnap.forEach((doc) => {
        backup.gastosFixos.push({ id: doc.id, ...doc.data() } as GastoFixo);
      });
    } catch {}
  }

  // 4. Exportar Dívidas
  const periodsDividas: string[] = [];
  if (incluirTodos || (!periodoInicio && !periodoFim)) {
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      periodsDividas.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  } else if (periodoInicio && periodoFim) {
    const [anoInicio, mesInicio] = periodoInicio.split('-').map(Number);
    const [anoFim, mesFim] = periodoFim.split('-').map(Number);
    const startDate = new Date(anoInicio, mesInicio - 1, 1);
    const endDate = new Date(anoFim, mesFim, 0);
    let current = new Date(startDate);
    while (current <= endDate) {
      periodsDividas.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
  }

  for (const periodo of periodsDividas) {
    try {
      const dividasSnap = await getDocs(collection(db, 'users', userId, 'dividas', periodo, 'itens'));
      dividasSnap.forEach((doc) => {
        backup.dividas.push({ id: doc.id, ...doc.data() } as Divida);
      });
    } catch {}
  }

  // 5. Exportar Cofrinhos
  const cofrinhosSnap = await getDocs(collection(db, 'users', userId, 'cofrinhos'));
  cofrinhosSnap.forEach((doc) => {
    backup.cofrinhos.push({ id: doc.id, ...doc.data() } as Cofrinho);
  });

  // 6. Exportar Categorias
  const categoriasSnap = await getDocs(collection(db, 'users', userId, 'categorias'));
  categoriasSnap.forEach((doc) => {
    backup.categorias.push({ id: doc.id, ...doc.data() } as Categoria);
  });

  // 7. Exportar Receitas Previstas
  const periodsReceitas: string[] = [];
  if (incluirTodos || (!periodoInicio && !periodoFim)) {
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      periodsReceitas.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  } else if (periodoInicio && periodoFim) {
    const [anoInicio, mesInicio] = periodoInicio.split('-').map(Number);
    const [anoFim, mesFim] = periodoFim.split('-').map(Number);
    const startDate = new Date(anoInicio, mesInicio - 1, 1);
    const endDate = new Date(anoFim, mesFim, 0);
    let current = new Date(startDate);
    while (current <= endDate) {
      periodsReceitas.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
  }

  for (const periodo of periodsReceitas) {
    try {
      const receitasSnap = await getDocs(collection(db, 'users', userId, 'receitasPrevistas', periodo, 'receitas'));
      receitasSnap.forEach((doc) => {
        backup.receitasPrevistas.push({ id: doc.id, ...doc.data() } as ReceitaPrevista);
      });
    } catch {}
  }

  // 8. Exportar Cartões de Crédito
  const cartoesSnap = await getDocs(collection(db, 'users', userId, 'creditCards'));
  for (const cardDoc of cartoesSnap.docs) {
    const cardData = { id: cardDoc.id, ...cardDoc.data() } as CartaoCredito;
    backup.cartoes.push(cardData);

    // 9. Exportar Compras de cada Cartão
    try {
      const comprasSnap = await getDocs(collection(db, 'users', userId, 'creditCards', cardDoc.id, 'compras'));
      comprasSnap.forEach((doc) => {
        backup.comprasCartao.push({ id: doc.id, ...doc.data() } as CompraCartao);
      });
    } catch {}
  }

  return backup;
};

// Importar dados de backup
export const importUserData = async (
  userId: string,
  backup: BackupData,
  options?: { substituirExistentes?: boolean }
): Promise<void> => {
  const substituir = options?.substituirExistentes ?? false;

  // 1. Importar Caixas
  for (const caixa of backup.caixas) {
    await setDoc(doc(db, 'users', userId, 'caixas', caixa.id), caixa);
  }

  // 2. Importar Transações
  const transacoesPorPeriodo = new Map<string, Transacao[]>();
  for (const transacao of backup.transacoes) {
    const periodo = (transacao as any).periodo || 
      `${new Date(transacao.data + 'T00:00:00').getFullYear()}-${String(new Date(transacao.data + 'T00:00:00').getMonth() + 1).padStart(2, '0')}`;
    if (!transacoesPorPeriodo.has(periodo)) {
      transacoesPorPeriodo.set(periodo, []);
    }
    transacoesPorPeriodo.get(periodo)!.push(transacao);
  }

  for (const [periodo, transacoes] of transacoesPorPeriodo.entries()) {
    for (const transacao of transacoes) {
      const payload: any = { ...transacao };
      delete payload.id;
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
      await setDoc(doc(db, 'users', userId, 'transacoes', periodo, 'itens', transacao.id), payload);
    }
  }

  // 3. Importar Gastos Fixos
  const gastosPorPeriodo = new Map<string, GastoFixo[]>();
  for (const gasto of backup.gastosFixos) {
    // GastoFixo tem campo 'periodo', não 'dataVencimento'
    const periodo = (gasto as any).periodo;
    if (!periodo) {
      // Se não tiver período no backup, usar período atual como fallback
      const now = new Date();
      const fallbackPeriodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (!gastosPorPeriodo.has(fallbackPeriodo)) {
        gastosPorPeriodo.set(fallbackPeriodo, []);
      }
      gastosPorPeriodo.get(fallbackPeriodo)!.push({ ...gasto, periodo: fallbackPeriodo } as GastoFixo);
    } else {
      if (!gastosPorPeriodo.has(periodo)) {
        gastosPorPeriodo.set(periodo, []);
      }
      gastosPorPeriodo.get(periodo)!.push(gasto);
    }
  }

  for (const [periodo, gastos] of gastosPorPeriodo.entries()) {
    for (const gasto of gastos) {
      const payload: any = { ...gasto };
      delete payload.id;
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
      await setDoc(doc(db, 'users', userId, 'gastosFixos', periodo, 'itens', gasto.id), payload);
    }
  }

  // 4. Importar Dívidas
  const dividasPorPeriodo = new Map<string, Divida[]>();
  for (const divida of backup.dividas) {
    const periodo = divida.periodo || 
      `${new Date(divida.dataVencimento + 'T00:00:00').getFullYear()}-${String(new Date(divida.dataVencimento + 'T00:00:00').getMonth() + 1).padStart(2, '0')}`;
    if (!dividasPorPeriodo.has(periodo)) {
      dividasPorPeriodo.set(periodo, []);
    }
    dividasPorPeriodo.get(periodo)!.push(divida);
  }

  for (const [periodo, dividas] of dividasPorPeriodo.entries()) {
    for (const divida of dividas) {
      const payload: any = { ...divida };
      delete payload.id;
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
      await setDoc(doc(db, 'users', userId, 'dividas', periodo, 'itens', divida.id), payload);
    }
  }

  // 5. Importar Cofrinhos
  for (const cofrinho of backup.cofrinhos) {
    await setDoc(doc(db, 'users', userId, 'cofrinhos', cofrinho.id), cofrinho);
  }

  // 6. Importar Categorias (só se não existirem ou se substituirExistentes)
  for (const categoria of backup.categorias) {
    if (substituir) {
      await setDoc(doc(db, 'users', userId, 'categorias', categoria.id), categoria);
    } else {
      const catDoc = await getDoc(doc(db, 'users', userId, 'categorias', categoria.id));
      if (!catDoc.exists()) {
        await setDoc(doc(db, 'users', userId, 'categorias', categoria.id), categoria);
      }
    }
  }

  // 7. Importar Receitas Previstas
  const receitasPorPeriodo = new Map<string, ReceitaPrevista[]>();
  for (const receita of backup.receitasPrevistas) {
    const periodo = receita.periodo || 
      `${new Date(receita.dataVencimento + 'T00:00:00').getFullYear()}-${String(new Date(receita.dataVencimento + 'T00:00:00').getMonth() + 1).padStart(2, '0')}`;
    if (!receitasPorPeriodo.has(periodo)) {
      receitasPorPeriodo.set(periodo, []);
    }
    receitasPorPeriodo.get(periodo)!.push(receita);
  }

  for (const [periodo, receitas] of receitasPorPeriodo.entries()) {
    for (const receita of receitas) {
      const payload: any = { ...receita };
      delete payload.id;
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
      await setDoc(doc(db, 'users', userId, 'receitasPrevistas', periodo, 'receitas', receita.id), payload);
    }
  }

  // 8. Importar Cartões de Crédito
  for (const cartao of backup.cartoes) {
    await setDoc(doc(db, 'users', userId, 'creditCards', cartao.id), cartao);
  }

  // 9. Importar Compras de Cartão
  for (const compra of backup.comprasCartao) {
    if (compra.cardId) {
      const payload: any = { ...compra };
      delete payload.id;
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
      await setDoc(doc(db, 'users', userId, 'creditCards', compra.cardId, 'compras', compra.id), payload);
      
      // Reconstruir faturas (mirrorPurchaseToInvoices)
      try {
        const parcelas = Math.max(1, compra.parcelas || 1);
        const valorParcela = compra.valorParcela || (compra.valorTotal / parcelas);
        const first = compra.startMonth || (compra.dataCompra ? `${new Date(compra.dataCompra).getFullYear()}-${String(new Date(compra.dataCompra).getMonth() + 1).padStart(2, '0')}` : undefined);
        if (first) {
          const [y0, m0] = first.split('-').map(Number);
          let y = y0, m = m0;
          for (let n = 1; n <= parcelas; n++) {
            const ym = `${y}-${String(m).padStart(2, '0')}`;
            const id = `${compra.id}-${n}`;
            const item = {
              id,
              purchaseId: compra.id,
              descricao: compra.descricao,
              valor: valorParcela,
              parcela: n,
              parcelasTotais: parcelas,
              startMonth: first,
            } as any;
            await setDoc(doc(db, 'users', userId, 'creditCards', compra.cardId, 'faturas', ym, 'itens', id), item);
            m += 1; if (m > 12) { m = 1; y += 1; }
          }
        }
      } catch {}
    }
  }
};


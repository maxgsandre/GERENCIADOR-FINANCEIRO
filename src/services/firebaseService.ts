import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
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
      { id: '1', descricao: 'Salário Principal', valor: 0, recebido: false, dataVencimento: new Date().toISOString().split('T')[0] },
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

  // Salvar receitas previstas iniciais
  for (const receita of initialData.receitasPrevistas) {
    await setDoc(doc(db, 'users', userId, 'receitasPrevistas', receita.id), receita);
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

// Funções para Gastos Fixos
export const saveGastoFixo = async (userId: string, gastoFixo: GastoFixo) => {
  await setDoc(doc(db, 'users', userId, 'gastosFixos', gastoFixo.id), gastoFixo);
};

export const deleteGastoFixo = async (userId: string, gastoFixoId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'gastosFixos', gastoFixoId));
};

export const subscribeToGastosFixos = (userId: string, callback: (gastosFixos: GastoFixo[]) => void) => {
  const q = query(collection(db, 'users', userId, 'gastosFixos'));
  return onSnapshot(q, (snapshot) => {
    const gastosFixos: GastoFixo[] = [];
    snapshot.forEach((doc) => {
      gastosFixos.push({ id: doc.id, ...doc.data() } as GastoFixo);
    });
    callback(gastosFixos);
  });
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

// Funções para Receitas Previstas
export const saveReceitaPrevista = async (userId: string, receita: ReceitaPrevista) => {
  await setDoc(doc(db, 'users', userId, 'receitasPrevistas', receita.id), receita);
};

export const deleteReceitaPrevista = async (userId: string, receitaId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'receitasPrevistas', receitaId));
};

export const subscribeToReceitasPrevistas = (userId: string, callback: (receitas: ReceitaPrevista[]) => void) => {
  const q = query(collection(db, 'users', userId, 'receitasPrevistas'));
  return onSnapshot(q, (snapshot) => {
    const receitas: ReceitaPrevista[] = [];
    snapshot.forEach((doc) => {
      receitas.push({ id: doc.id, ...doc.data() } as ReceitaPrevista);
    });
    callback(receitas);
  });
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
// Serviço para armazenamento local quando Firebase não está configurado
import { Caixa, Transacao, GastoFixo, Divida, Cofrinho, Categoria, ReceitaPrevista } from '../App';

const STORAGE_KEYS = {
  caixas: 'financeiro_caixas',
  transacoes: 'financeiro_transacoes',
  gastosFixos: 'financeiro_gastos_fixos',
  dividas: 'financeiro_dividas',
  cofrinhos: 'financeiro_cofrinhos',
  categorias: 'financeiro_categorias',
  receitasPrevistas: 'financeiro_receitas_previstas',
  initialized: 'financeiro_initialized'
};

// Dados iniciais
const initialData = {
  caixas: [
    { id: '1', nome: 'Conta Corrente', saldo: 2500.00, tipo: 'conta_corrente' as const },
    { id: '2', nome: 'Poupança', saldo: 8000.00, tipo: 'poupanca' as const },
    { id: '3', nome: 'Carteira', saldo: 150.00, tipo: 'carteira' as const },
  ],
  transacoes: [
    { id: '1', caixaId: '1', tipo: 'entrada' as const, valor: 3000, descricao: 'Salário', categoria: 'Trabalho', data: '2024-09-01', hora: '08:30' },
    { id: '2', caixaId: '1', tipo: 'saida' as const, valor: 800, descricao: 'Aluguel', categoria: 'Moradia', data: '2024-09-05', hora: '14:15' },
    { id: '3', caixaId: '2', tipo: 'entrada' as const, valor: 500, descricao: 'Freelance', categoria: 'Trabalho', data: '2024-09-10', hora: '16:45' },
  ],
  gastosFixos: [
    { id: '1', descricao: 'Aluguel', valor: 800, categoria: 'Moradia', diaVencimento: 5, pago: true },
    { id: '2', descricao: 'Internet', valor: 80, categoria: 'Utilidades', diaVencimento: 15, pago: false },
    { id: '3', descricao: 'Academia', valor: 120, categoria: 'Saúde', diaVencimento: 20, pago: false },
  ],
  dividas: [
    { 
      id: '1', 
      descricao: 'Cartão de Crédito', 
      valorTotal: 2000, 
      valorPago: 400, 
      parcelas: 10, 
      parcelasPagas: 2, 
      valorParcela: 200,
      dataVencimento: '2024-09-15',
      tipo: 'parcelada' as const
    },
    { 
      id: '2', 
      descricao: 'Empréstimo Pessoal', 
      valorTotal: 5000, 
      valorPago: 0, 
      parcelas: 1, 
      parcelasPagas: 0, 
      valorParcela: 5000,
      dataVencimento: '2024-12-01',
      tipo: 'total' as const
    },
  ],
  cofrinhos: [
    { 
      id: '1', 
      nome: 'Emergência', 
      saldo: 3000, 
      objetivo: 10000, 
      percentualCDI: 100, 
      rendimentoMensal: 45.30,
      dataCriacao: '2024-08-01',
      cor: '#10b981'
    },
    { 
      id: '2', 
      nome: 'Viagem', 
      saldo: 1500, 
      objetivo: 5000, 
      percentualCDI: 85, 
      rendimentoMensal: 19.13,
      dataCriacao: '2024-09-01',
      cor: '#3b82f6'
    },
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
    { id: '15', nome: 'Pets' },
    { id: '16', nome: 'Presentes' },
    { id: '17', nome: 'Manutenção' },
  ],
  receitasPrevistas: [
    { id: '1', descricao: 'Salário Principal', valor: 3500, recebido: true, dataVencimento: '2024-09-05' },
    { id: '2', descricao: 'Salário Cônjuge', valor: 2800, recebido: false, dataVencimento: '2024-09-10' },
    { id: '3', descricao: 'Freelance', valor: 800, recebido: false, dataVencimento: '2024-09-15' },
  ]
};

// Função para inicializar dados se não existirem
export const initializeLocalStorage = () => {
  const isInitialized = localStorage.getItem(STORAGE_KEYS.initialized);
  
  if (!isInitialized) {
    Object.entries(initialData).forEach(([key, data]) => {
      const storageKey = STORAGE_KEYS[key as keyof typeof STORAGE_KEYS];
      localStorage.setItem(storageKey, JSON.stringify(data));
    });
    localStorage.setItem(STORAGE_KEYS.initialized, 'true');
  }
};

// Funções genéricas para localStorage
function getFromStorage<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Erro ao carregar ${key}:`, error);
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Erro ao salvar ${key}:`, error);
  }
}

function saveItemToStorage<T extends { id: string }>(key: string, item: T): void {
  const items = getFromStorage<T>(key);
  const index = items.findIndex(i => i.id === item.id);
  
  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }
  
  saveToStorage(key, items);
}

function deleteItemFromStorage<T extends { id: string }>(key: string, itemId: string): void {
  const items = getFromStorage<T>(key);
  const filteredItems = items.filter(item => item.id !== itemId);
  saveToStorage(key, filteredItems);
}

// Funções específicas para cada tipo de dados
export const localStorageService = {
  // Caixas
  getCaixas: (): Caixa[] => getFromStorage<Caixa>(STORAGE_KEYS.caixas),
  saveCaixa: (caixa: Caixa) => saveItemToStorage<Caixa>(STORAGE_KEYS.caixas, caixa),
  deleteCaixa: (caixaId: string) => deleteItemFromStorage<Caixa>(STORAGE_KEYS.caixas, caixaId),

  // Transações
  getTransacoes: (): Transacao[] => getFromStorage<Transacao>(STORAGE_KEYS.transacoes),
  saveTransacao: (transacao: Transacao) => saveItemToStorage<Transacao>(STORAGE_KEYS.transacoes, transacao),
  deleteTransacao: (transacaoId: string) => deleteItemFromStorage<Transacao>(STORAGE_KEYS.transacoes, transacaoId),

  // Gastos Fixos
  getGastosFixos: (): GastoFixo[] => getFromStorage<GastoFixo>(STORAGE_KEYS.gastosFixos),
  saveGastoFixo: (gastoFixo: GastoFixo) => saveItemToStorage<GastoFixo>(STORAGE_KEYS.gastosFixos, gastoFixo),
  deleteGastoFixo: (gastoFixoId: string) => deleteItemFromStorage<GastoFixo>(STORAGE_KEYS.gastosFixos, gastoFixoId),

  // Dívidas
  getDividas: (): Divida[] => getFromStorage<Divida>(STORAGE_KEYS.dividas),
  saveDivida: (divida: Divida) => saveItemToStorage<Divida>(STORAGE_KEYS.dividas, divida),
  deleteDivida: (dividaId: string) => deleteItemFromStorage<Divida>(STORAGE_KEYS.dividas, dividaId),

  // Cofrinhos
  getCofrinhos: (): Cofrinho[] => getFromStorage<Cofrinho>(STORAGE_KEYS.cofrinhos),
  saveCofrinho: (cofrinho: Cofrinho) => saveItemToStorage<Cofrinho>(STORAGE_KEYS.cofrinhos, cofrinho),
  deleteCofrinho: (cofrinhoId: string) => deleteItemFromStorage<Cofrinho>(STORAGE_KEYS.cofrinhos, cofrinhoId),

  // Categorias
  getCategorias: (): Categoria[] => getFromStorage<Categoria>(STORAGE_KEYS.categorias),
  saveCategoria: (categoria: Categoria) => saveItemToStorage<Categoria>(STORAGE_KEYS.categorias, categoria),
  deleteCategoria: (categoriaId: string) => deleteItemFromStorage<Categoria>(STORAGE_KEYS.categorias, categoriaId),

  // Receitas Previstas
  getReceitasPrevistas: (): ReceitaPrevista[] => getFromStorage<ReceitaPrevista>(STORAGE_KEYS.receitasPrevistas),
  saveReceitaPrevista: (receita: ReceitaPrevista) => saveItemToStorage<ReceitaPrevista>(STORAGE_KEYS.receitasPrevistas, receita),
  deleteReceitaPrevista: (receitaId: string) => deleteItemFromStorage<ReceitaPrevista>(STORAGE_KEYS.receitasPrevistas, receitaId),
};
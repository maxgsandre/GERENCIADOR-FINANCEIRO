import React, { useState, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import logoPng from './assets/logo.png';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { Button } from './components/ui/button';
import { useIsMobile } from './components/ui/use-mobile';
import { useTheme } from 'next-themes';
import { Home, Wallet, ArrowUpDown, CreditCard, TrendingDown, Menu } from 'lucide-react';
import Dashboard from './components/Dashboard';
import CaixasManager from './components/CaixasManager';
import TransacoesManager from './components/TransacoesManager';
import GastosFixosManager from './components/GastosFixosManager';
import DividasManager from './components/DividasManager';
import UserMenu from './components/UserMenu';
import AuthWrapper from './components/Auth/AuthWrapper';
import LoadingSpinner from './components/LoadingSpinner';
import Logo from './components/Logo';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import * as firebaseService from './services/firebaseService';

// Types para os dados financeiros
export interface Caixa {
  id: string;
  nome: string;
  saldo: number;
  tipo: 'conta_corrente' | 'poupanca' | 'carteira' | 'investimento';
}

export interface Transacao {
  id: string;
  caixaId: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
  hora: string;
}

export interface GastoFixo {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  diaVencimento: number;
  pago: boolean;
  valorPago?: number;
}

export interface Divida {
  id: string;
  descricao: string;
  valorTotal: number;
  valorPago: number;
  parcelas: number;
  parcelasPagas: number;
  valorParcela: number;
  dataVencimento: string;
  tipo: 'parcelada' | 'total';
}

export interface Cofrinho {
  id: string;
  nome: string;
  saldo: number;
  objetivo?: number;
  percentualCDI: number;
  rendimentoMensal: number;
  dataCriacao: string;
  cor: string;
}

export interface Categoria {
  id: string;
  nome: string;
}

export interface ReceitaPrevista {
  id: string;
  descricao: string;
  valor: number;
  recebido: boolean;
  dataVencimento: string;
}

// Cartão de crédito
export interface CartaoCredito {
  id: string;
  nome: string;
  observacao?: string;
  limite?: number;
  diaVencimento?: number;
}

export interface CompraCartao {
  id: string;
  cardId: string;
  descricao: string;
  valorTotal: number;
  parcelas: number; // 1 para à vista
  valorParcela: number;
  startMonth: string; // YYYY-MM primeira competência
  dataCompra: string; // YYYY-MM-DD
  parcelasPagas: number;
  startDay?: number;
}

// Context para dados globais
export interface FinanceiroContextType {
  caixas: Caixa[];
  setCaixas: React.Dispatch<React.SetStateAction<Caixa[]>>;
  transacoes: Transacao[];
  setTransacoes: React.Dispatch<React.SetStateAction<Transacao[]>>;
  gastosFixos: GastoFixo[];
  setGastosFixos: React.Dispatch<React.SetStateAction<GastoFixo[]>>;
  dividas: Divida[];
  setDividas: React.Dispatch<React.SetStateAction<Divida[]>>;
  cartoes: CartaoCredito[];
  setCartoes: React.Dispatch<React.SetStateAction<CartaoCredito[]>>;
  comprasCartao: CompraCartao[];
  setComprasCartao: React.Dispatch<React.SetStateAction<CompraCartao[]>>;
  cofrinhos: Cofrinho[];
  setCofrinhos: React.Dispatch<React.SetStateAction<Cofrinho[]>>;
  categorias: Categoria[];
  setCategorias: React.Dispatch<React.SetStateAction<Categoria[]>>;
  receitasPrevistas: ReceitaPrevista[];
  setReceitasPrevistas: React.Dispatch<React.SetStateAction<ReceitaPrevista[]>>;
  selectedCaixaId: string | null;
  setSelectedCaixaId: React.Dispatch<React.SetStateAction<string | null>>;
  goToTab: (key: string) => void;
  // Funções para salvar no Firebase
  saveCaixa: (caixa: Caixa) => Promise<void>;
  deleteCaixa: (caixaId: string) => Promise<void>;
  saveTransacao: (transacao: Transacao) => Promise<void>;
  deleteTransacao: (transacaoId: string) => Promise<void>;
  saveGastoFixo: (gastoFixo: GastoFixo) => Promise<void>;
  deleteGastoFixo: (gastoFixoId: string) => Promise<void>;
  saveDivida: (divida: Divida) => Promise<void>;
  deleteDivida: (dividaId: string) => Promise<void>;
  saveCofrinho: (cofrinho: Cofrinho) => Promise<void>;
  deleteCofrinho: (cofrinhoId: string) => Promise<void>;
  saveCategoria: (categoria: Categoria) => Promise<void>;
  deleteCategoria: (categoriaId: string) => Promise<void>;
  saveReceitaPrevista: (receita: ReceitaPrevista) => Promise<void>;
  deleteReceitaPrevista: (receitaId: string) => Promise<void>;
  saveCartao: (card: CartaoCredito) => Promise<void>;
  deleteCartao: (cardId: string) => Promise<void>;
  saveCompraCartao: (purchase: CompraCartao) => Promise<void>;
  deleteCompraCartao: (purchaseId: string) => Promise<void>;
}

export const FinanceiroContext = React.createContext<FinanceiroContextType | null>(null);

const menuItems = [
  { icon: Home, label: 'Dashboard', key: 'dashboard' },
  { icon: Wallet, label: 'Caixas', key: 'caixas' },
  { icon: ArrowUpDown, label: 'Transações', key: 'transacoes' },
  { icon: CreditCard, label: 'Gastos Fixos', key: 'gastos' },
  { icon: TrendingDown, label: 'Dívidas', key: 'dividas' },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return sessionStorage.getItem('active_tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const { currentUser, loading } = useAuth();
  
  // Estados para dados financeiros - sempre declarar todos os hooks
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [gastosFixos, setGastosFixos] = useState<GastoFixo[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [comprasCartao, setComprasCartao] = useState<CompraCartao[]>([]);
  const [cofrinhos, setCofrinhos] = useState<Cofrinho[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [receitasPrevistas, setReceitasPrevistas] = useState<ReceitaPrevista[]>([]);
  const [selectedCaixaId, setSelectedCaixaId] = useState<string | null>(null);

  // Configurar listeners do Firebase ou localStorage quando o usuário logar
  useEffect(() => {
    if (!currentUser) return;

    // Configurar listeners do Firebase
    firebaseService.createUserDocument(currentUser);

    const unsubscribeCaixas = firebaseService.subscribeToCaixas(currentUser.uid, setCaixas);
    const unsubscribeTransacoes = firebaseService.subscribeToTransacoes(currentUser.uid, setTransacoes);
    const unsubscribeGastosFixos = firebaseService.subscribeToGastosFixos(currentUser.uid, setGastosFixos);
    const unsubscribeDividas = firebaseService.subscribeToDividas(currentUser.uid, setDividas);
    const unsubscribeCofrinhos = firebaseService.subscribeToCofrinhos(currentUser.uid, setCofrinhos);
    const unsubscribeCategorias = firebaseService.subscribeToCategorias(currentUser.uid, setCategorias);
    const unsubscribeReceitasPrevistas = firebaseService.subscribeToReceitasPrevistas(currentUser.uid, setReceitasPrevistas);
    const unsubscribeCards = (firebaseService as any).subscribeToCreditCards ? (firebaseService as any).subscribeToCreditCards(currentUser.uid, setCartoes) : () => {};
    const unsubscribePurchases = (firebaseService as any).subscribeToCreditCardPurchases ? (firebaseService as any).subscribeToCreditCardPurchases(currentUser.uid, setComprasCartao) : () => {};

    // Cleanup function
    return () => {
      unsubscribeCaixas();
      unsubscribeTransacoes();
      unsubscribeGastosFixos();
      unsubscribeDividas();
      unsubscribeCofrinhos();
      unsubscribeCategorias();
      unsubscribeReceitasPrevistas();
      unsubscribeCards();
      unsubscribePurchases();
    };
  }, [currentUser]);

  // Funções para integração com Firebase ou localStorage
  const saveCaixa = async (caixa: Caixa) => {
    if (currentUser) {
      await firebaseService.saveCaixa(currentUser.uid, caixa);
    }
  };

  const deleteCaixa = async (caixaId: string) => {
    if (currentUser) {
      await firebaseService.deleteCaixa(currentUser.uid, caixaId);
    }
  };

  const saveTransacao = async (transacao: Transacao) => {
    if (currentUser) {
      await firebaseService.saveTransacao(currentUser.uid, transacao);
    }
  };

  const deleteTransacao = async (transacaoId: string) => {
    if (currentUser) {
      await firebaseService.deleteTransacao(currentUser.uid, transacaoId);
    }
  };

  const saveGastoFixo = async (gastoFixo: GastoFixo) => {
    if (currentUser) {
      await firebaseService.saveGastoFixo(currentUser.uid, gastoFixo);
    }
  };

  const deleteGastoFixo = async (gastoFixoId: string) => {
    if (currentUser) {
      await firebaseService.deleteGastoFixo(currentUser.uid, gastoFixoId);
      // Atualizar estado local imediatamente para melhor UX
      setGastosFixos(prev => prev.filter(g => g.id !== gastoFixoId));
    }
  };

  const saveDivida = async (divida: Divida) => {
    if (currentUser) {
      await firebaseService.saveDivida(currentUser.uid, divida);
    }
  };

  const deleteDivida = async (dividaId: string) => {
    if (currentUser) {
      await firebaseService.deleteDivida(currentUser.uid, dividaId);
    }
  };

  const saveCofrinho = async (cofrinho: Cofrinho) => {
    if (currentUser) {
      await firebaseService.saveCofrinho(currentUser.uid, cofrinho);
    }
  };

  const deleteCofrinho = async (cofrinhoId: string) => {
    if (currentUser) {
      await firebaseService.deleteCofrinho(currentUser.uid, cofrinhoId);
    }
  };

  const saveCategoria = async (categoria: Categoria) => {
    if (currentUser) {
      await firebaseService.saveCategoria(currentUser.uid, categoria);
    }
  };

  const deleteCategoria = async (categoriaId: string) => {
    if (currentUser) {
      await firebaseService.deleteCategoria(currentUser.uid, categoriaId);
    }
  };

  const saveReceitaPrevista = async (receita: ReceitaPrevista) => {
    if (currentUser) {
      await firebaseService.saveReceitaPrevista(currentUser.uid, receita);
    }
  };

  const deleteReceitaPrevista = async (receitaId: string) => {
    if (currentUser) {
      await firebaseService.deleteReceitaPrevista(currentUser.uid, receitaId);
    }
  };

  const saveCartao = async (card: CartaoCredito) => {
    if (currentUser) {
      await (firebaseService as any).saveCreditCard(currentUser.uid, card);
    }
  };

  const deleteCartao = async (cardId: string) => {
    if (currentUser) {
      await (firebaseService as any).deleteCreditCard(currentUser.uid, cardId);
    }
  };

  const saveCompraCartao = async (purchase: CompraCartao) => {
    if (currentUser) {
      await (firebaseService as any).saveCreditCardPurchase(currentUser.uid, purchase);
    }
  };

  const deleteCompraCartao = async (purchaseId: string) => {
    if (currentUser) {
      await (firebaseService as any).deleteCreditCardPurchase(currentUser.uid, purchaseId);
      // Atualizar estado local imediatamente para melhor UX
      setComprasCartao(prev => prev.filter(p => p.id !== purchaseId));
    }
  };

  const contextValue: FinanceiroContextType = {
    caixas,
    setCaixas,
    transacoes,
    setTransacoes,
    gastosFixos,
    setGastosFixos,
    dividas,
    setDividas,
    cartoes,
    setCartoes,
    comprasCartao,
    setComprasCartao,
    cofrinhos,
    setCofrinhos,
    categorias,
    setCategorias,
    receitasPrevistas,
    setReceitasPrevistas,
    selectedCaixaId,
    setSelectedCaixaId,
    goToTab: (key: string) => {
      setActiveTab(key);
      try {
        sessionStorage.setItem('active_tab', key);
      } catch {}
      setIsSheetOpen(false);
    },
    saveCaixa,
    deleteCaixa,
    saveTransacao,
    deleteTransacao,
    saveGastoFixo,
    deleteGastoFixo,
    saveDivida,
    deleteDivida,
    saveCofrinho,
    deleteCofrinho,
    saveCategoria,
    deleteCategoria,
    saveReceitaPrevista,
    deleteReceitaPrevista,
    saveCartao: async (card: CartaoCredito) => { if (currentUser) await (firebaseService as any).saveCreditCard(currentUser.uid, card); },
    deleteCartao: async (cardId: string) => { if (currentUser) await (firebaseService as any).deleteCreditCard(currentUser.uid, cardId); },
    saveCompraCartao: async (purchase: CompraCartao) => { if (currentUser) await (firebaseService as any).saveCreditCardPurchase(currentUser.uid, purchase); },
    deleteCompraCartao: async (purchaseId: string) => { if (currentUser) await (firebaseService as any).deleteCreditCardPurchase(currentUser.uid, purchaseId); },
  };

  // Mostrar loading enquanto carrega
  if (loading) {
    return <LoadingSpinner message="Carregando aplicação..." />;
  }

  // Se não estiver logado, mostrar tela de autenticação
  if (!currentUser) {
    return <AuthWrapper />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'caixas':
        return <CaixasManager />;
      case 'transacoes':
        return <TransacoesManager />;
      case 'gastos':
        return <GastosFixosManager />;
      case 'dividas':
        return <DividasManager />;
      default:
        return <Dashboard />;
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    try {
      sessionStorage.setItem('active_tab', key);
    } catch {}
    setIsSheetOpen(false);
  };
  const goToTab = (key: string) => handleTabChange(key);

  // Layout Mobile
  if (isMobile) {
    return (
      <FinanceiroContext.Provider value={contextValue}>
        <div className="flex flex-col h-screen w-full bg-background">
          {/* Header móvel */}
          <header className="border-b bg-background px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              {/* Removido símbolo antigo no header mobile */}
              <h1 className="text-lg font-semibold">
                {menuItems.find(item => item.key === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                <div className="py-4">
                  <div className="flex items-center px-4 mb-1">
                    {/* Remove ícone antigo e nome, exibe apenas a logo PNG */}
                    <img src={logoPng} alt="Logo" className="h-6" />
                  </div>
                  <nav className="space-y-2">
                    {menuItems.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => handleTabChange(item.key)}
                        className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                          activeTab === item.key
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent text-foreground'
                        }`}
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
                </SheetContent>
              </Sheet>
              <UserMenu />
            </div>
          </header>
          
          
          {/* Conteúdo principal */}
          <main className="flex-1 overflow-auto p-4">
            {renderContent()}
          </main>
          
          {/* Navegação inferior */}
          <nav className="border-t bg-background px-2 py-2">
            <div className="flex justify-around">
              {menuItems.slice(0, 5).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg transition-colors ${
                    activeTab === item.key
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5 mb-1" />
                  <span className="text-xs">{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>
      </FinanceiroContext.Provider>
    );
  }

  // Layout Desktop
  return (
    <FinanceiroContext.Provider value={contextValue}>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <div className="px-4 py-0">
                  <img src={logoPng} alt="Logo" className="h-6" />
                </div>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {menuItems.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          onClick={() => setActiveTab(item.key)}
                          isActive={activeTab === item.key}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          
          <main className="flex-1 flex flex-col">
            <header className="border-b bg-background px-6 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <SidebarTrigger />
                <h1 className="ml-4 font-medium">
                  {menuItems.find(item => item.key === activeTab)?.label || 'Dashboard'}
                </h1>
              </div>
              <UserMenu />
            </header>
            
            <div className="flex-1 overflow-auto p-6">
              {renderContent()}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </FinanceiroContext.Provider>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true} storageKey="theme">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
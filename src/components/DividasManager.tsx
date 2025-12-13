import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Progress } from './ui/progress';
import { Trash2, Plus, Edit, Calendar, CheckCircle, Circle, CreditCard, DollarSign, Wallet, Loader2 } from 'lucide-react';
import { FinanceiroContext, Divida, GastoFixo, CartaoCredito, CompraCartao } from '../App';
import { calculateMonthlyTotals } from '../utils/monthlyCalculations';

type DividaView = Divida & { dataVencimentoExibida?: string };

function getQuitYM(d: Divida): { y: number; m: number } | null {
  return null;
}

export default function DividasManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { dividas, setDividas, saveDivida, deleteDivida, caixas, saveCaixa, transacoes, saveTransacao, deleteTransacao, cartoes = [], setCartoes, comprasCartao = [], setComprasCartao, saveCartao, saveCompraCartao, categorias = [] } = context as any;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const scrollBeforeDialogRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false);
  const transacoesEmCriacaoRef = useRef<Set<string>>(new Set());
  const [editingDivida, setEditingDivida] = useState<Divida | null>(null);
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [dividaSelecionada, setDividaSelecionada] = useState<Divida | null>(null);
  const [compraSelecionada, setCompraSelecionada] = useState<CompraCartao | null>(null);
  const [caixaPagamento, setCaixaPagamento] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [valorPagamentoInput, setValorPagamentoInput] = useState('');
  const [modoPagamento, setModoPagamento] = useState<'pay' | 'refund'>('pay');
  const [dataPagamento, setDataPagamento] = useState('');
  const [horaPagamento, setHoraPagamento] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`; // YYYY-MM
  });
  const [formData, setFormData] = useState({
    descricao: '',
    valorTotal: '',
    parcelas: '',
    valorParcela: '',
    dataVencimento: '',
    tipo: 'parcelada' as 'parcelada' | 'total',
    categoria: 'Esporádicos',
    emAndamento: false,
    parcelaAtual: '',
    dataUltimoPagamento: ''
  });
  // Cartões - dialogs e formulários
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isEditCardDialogOpen, setIsEditCardDialogOpen] = useState(false);
  const [isEditPurchaseDialogOpen, setIsEditPurchaseDialogOpen] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardDueDay, setCardDueDay] = useState('15');
  const [editingCard, setEditingCard] = useState<CartaoCredito | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<CompraCartao | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [purchaseDesc, setPurchaseDesc] = useState('');
  const [purchaseValorTotal, setPurchaseValorTotal] = useState('');
  const [purchaseParcelas, setPurchaseParcelas] = useState('1');
  const [purchaseValorParcela, setPurchaseValorParcela] = useState('');
  const [purchaseStartDate, setPurchaseStartDate] = useState(() => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'));
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'));
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  
  // Estados para dívida em andamento na compra
  const [purchaseEmAndamento, setPurchaseEmAndamento] = useState(false);
  const [purchaseParcelaAtual, setPurchaseParcelaAtual] = useState('');
  const [purchaseDataUltimoPagamento, setPurchaseDataUltimoPagamento] = useState('');

  // Calcula automaticamente o valor da parcela quando total/parcelas mudarem.
  const recomputeParcela = (totalStr: string, parcelasStr: string) => {
    const total = parseFloat(totalStr.replace(',', '.'));
    const parcelas = parseInt(parcelasStr);
    if (!isFinite(total) || !isFinite(parcelas) || parcelas <= 0) return '';
    // valor base arredondado para 2 casas
    const base = Math.floor((total / parcelas) * 100) / 100; // trunca para evitar exceder
    const residual = Math.round(total * 100) - (base * 100 * parcelas);
    // A última parcela receberá o residual (pode ser 0..(parcelas-1) centavos)
    // Para o input exibimos o valor base; ao salvar ajustaremos a última parcela.
    return (base).toFixed(2);
  };

  // Calcula automaticamente o valor total quando parcela/parcelas mudarem.
  const recomputeTotal = (parcelaStr: string, parcelasStr: string) => {
    const parcela = parseFloat(parcelaStr.replace(',', '.'));
    const parcelas = parseInt(parcelasStr);
    if (!isFinite(parcela) || !isFinite(parcelas) || parcelas <= 0) return '';
    const total = parcela * parcelas;
    return total.toFixed(2);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSaving) return;
    
    if (!formData.descricao || !formData.valorTotal || !formData.dataVencimento) return;

    setIsSaving(true);
    
    try {
      // Ajusta parcela automaticamente se for parcelada e não informada
      let valorParcelaNum = formData.tipo === 'parcelada'
        ? (formData.valorParcela ? parseFloat(formData.valorParcela) : parseFloat(recomputeParcela(formData.valorTotal, formData.parcelas) || '0'))
        : parseFloat(formData.valorTotal);

      // Se for uma compra de cartão (id começa com purchase:), atualiza a compra em vez da dívida
      if (editingDivida?.id && editingDivida.id.startsWith('purchase:')) {
        const purchaseId = editingDivida.id.replace('purchase:', '');
        
        const compraAtual = (comprasCartao as CompraCartao[]).find(p => p.id === purchaseId);
        
        if (!compraAtual) {
          return;
        }
        
        const cardForPurchase = (cartoes as CartaoCredito[]).find(c => c.id === compraAtual.cardId);
        
        // Calcular parcelas pagas se for dívida em andamento
        const parcelasPagas = formData.emAndamento ? Math.max(0, parseInt(formData.parcelaAtual) - 1) : (compraAtual.parcelasPagas || 0);
        
        const updated: CompraCartao = {
          ...compraAtual,
          descricao: formData.descricao,
          valorTotal: parseFloat(formData.valorTotal),
          parcelas: formData.tipo === 'parcelada' ? parseInt(formData.parcelas) : 1,
          valorParcela: formData.tipo === 'parcelada' ? valorParcelaNum : parseFloat(formData.valorTotal),
          startMonth: new Date(formData.dataVencimento + 'T00:00:00').toISOString().slice(0,7),
          startDay: (cardForPurchase?.diaVencimento || compraAtual.startDay || 5),
          parcelasPagas: parcelasPagas,
        } as CompraCartao;
        
        await saveCompraCartao(updated);
        
        setComprasCartao((prev: CompraCartao[]) => prev.map(p => p.id === updated.id ? updated : p));
        
      } else {
        // Calcular parcelas pagas e valor pago se for dívida em andamento
        const parcelasPagas = formData.emAndamento ? Math.max(0, parseInt(formData.parcelaAtual) - 1) : (editingDivida?.parcelasPagas || 0);
        const valorPago = formData.emAndamento ? valorParcelaNum * parcelasPagas : (editingDivida?.valorPago || 0);

    const novaDivida: Divida = {
          id: editingDivida?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString()),
      descricao: formData.descricao,
      valorTotal: parseFloat(formData.valorTotal),
          valorPago: valorPago,
      parcelas: formData.tipo === 'parcelada' ? parseInt(formData.parcelas) : 1,
          parcelasPagas: parcelasPagas,
      valorParcela: formData.tipo === 'parcelada' 
            ? valorParcelaNum 
        : parseFloat(formData.valorTotal),
          dataVencimento: new Date(formData.dataVencimento + 'T00:00:00').toISOString().split('T')[0],
      tipo: formData.tipo,
          categoria: formData.categoria,
        } as any;

        // Usar o mês selecionado no filtro como competência inicial para novas dívidas
        // Se for edição, manter comportamento atual (sem competenciaInicial)
        if (!editingDivida) {
          (novaDivida as any).competenciaInicial = selectedMonth;
        }

        await saveDivida(novaDivida);
        // Não precisa atualizar manualmente o estado - o subscribeToDividas já faz isso automaticamente
        // Isso evita duplicatas quando salva dívidas parceladas (que criam múltiplas parcelas)

    }

    resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valorTotal: '',
      parcelas: '',
      valorParcela: '',
      dataVencimento: '',
      tipo: 'parcelada',
      categoria: 'Esporádicos',
      emAndamento: false,
      parcelaAtual: '',
      dataUltimoPagamento: ''
    });
    setEditingDivida(null);
    setIsDialogOpen(false);
    try { setTimeout(() => window.scrollTo({ top: scrollBeforeDialogRef.current || 0, left: 0, behavior: 'instant' as ScrollBehavior }), 60); } catch {}
  };

  // Evitar salto de scroll ao abrir/fechar o diálogo (trava o body)
  useEffect(() => {
    const body = document.body as HTMLBodyElement;
    if (isDialogOpen) {
      try {
        scrollBeforeDialogRef.current = window.scrollY || 0;
        body.style.position = 'fixed';
        body.style.top = `-${scrollBeforeDialogRef.current}px`;
        body.style.width = '100%';
      } catch {}
    } else {
      const top = body.style.top;
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      if (top) {
        try { window.scrollTo(0, -parseInt(top || '0')); } catch {}
      }
    }
  }, [isDialogOpen]);


  // CRUD simples de cartões e compras (na própria seção de dívidas)
  const [isSubmittingCreateCard, setIsSubmittingCreateCard] = useState(false);
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCreateCard) return;
    if (!cardName.trim()) return;
    setIsSubmittingCreateCard(true);
    const novo: CartaoCredito = { id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(), nome: cardName.trim(), limite: cardLimit ? parseFloat(cardLimit) : undefined, diaVencimento: parseInt(cardDueDay || '15') } as any;
    await saveCartao(novo);
    setCardName('');
    setIsCardDialogOpen(false);
    setCardName(''); setCardLimit(''); setCardDueDay('15');
    setIsSubmittingCreateCard(false);
  };

  const [isSubmittingCreatePurchase, setIsSubmittingCreatePurchase] = useState(false);
  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCreatePurchase) return;
    if (!selectedCardId || !purchaseDesc || !purchaseValorTotal || !purchaseValorParcela || !purchaseStartDate) return;
    const startMonth = purchaseStartDate.slice(0,7);
    const selectedCard = (cartoes as CartaoCredito[]).find(c => c.id === selectedCardId);
    const startDay = selectedCard?.diaVencimento || 5;
    
    // Calcular parcelas pagas se for dívida em andamento
    const parcelasPagas = purchaseEmAndamento ? Math.max(0, parseInt(purchaseParcelaAtual) - 1) : 0;
    
    const p: CompraCartao = {
      id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(),
      cardId: selectedCardId,
      descricao: purchaseDesc,
      valorTotal: parseFloat(purchaseValorTotal),
      parcelas: parseInt(purchaseParcelas || '1'),
      valorParcela: parseFloat(purchaseValorParcela),
      startMonth,
      dataCompra: purchaseDate,
      parcelasPagas: parcelasPagas,
      valorPago: 0, // Inicializar valorPago como 0
      startDay,
    } as any;
    setIsSubmittingCreatePurchase(true);
    await saveCompraCartao(p);


    setIsPurchaseDialogOpen(false);
    setPurchaseDesc(''); setPurchaseValorTotal(''); setPurchaseParcelas('1'); setPurchaseValorParcela(''); setPurchaseStartDate(`${selectedMonth}-05`);
    setPurchaseEmAndamento(false); setPurchaseParcelaAtual(''); setPurchaseDataUltimoPagamento('');
    setIsSubmittingCreatePurchase(false);
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Excluir este cartão e suas compras?')) return;
    try {
      // Estornar transações de todas as compras deste cartão
      const compras = (comprasCartao as CompraCartao[]).filter(p => p.cardId === cardId);
      for (const c of compras) {
        // As transações serão revertidas automaticamente pelo useEffect
      }


      // remover compras deste cartão
      for (const c of compras) {
        await (context as any).deleteCompraCartao(c.id);
      }

      // remover cartão
      await (context as any).deleteCartao(cardId);
    } catch (e) {
      alert('Não foi possível excluir o cartão.');
    }
  };

  const openEditCard = (card: CartaoCredito) => {
    setEditingCard(card);
    setCardName(card.nome || '');
    setCardLimit(card.limite != null ? String(card.limite) : '');
    setCardDueDay(card.diaVencimento != null ? String(card.diaVencimento) : '15');
    setIsEditCardDialogOpen(true);
  };

  const openEditPurchase = (purchase: CompraCartao) => {
    setEditingPurchase(purchase);
    setPurchaseDesc(purchase.descricao);
    setPurchaseValorTotal(String(purchase.valorTotal));
    setPurchaseParcelas(String(purchase.parcelas));
    setPurchaseValorParcela(String(purchase.valorParcela));
    setPurchaseStartDate(purchase.startMonth + '-05');
    setPurchaseDate(new Date(purchase.dataCompra).toISOString().slice(0,10));
    setPurchaseEmAndamento(purchase.parcelasPagas > 0);
    setPurchaseParcelaAtual(String(purchase.parcelasPagas + 1));
    setSelectedCardId(purchase.cardId);
    setIsEditPurchaseDialogOpen(true);
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    if (!confirm('Excluir esta compra? Esta ação não pode ser desfeita.')) return;
    try {
      await (context as any).deleteCompraCartao(purchaseId);
      setComprasCartao((prev: CompraCartao[]) => prev.filter(p => p.id !== purchaseId));
    } catch (e) {
      alert('Não foi possível excluir a compra.');
    }
  };

  const [isSubmittingEditCard, setIsSubmittingEditCard] = useState(false);
  const handleSaveEditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEditCard) return;
    if (!editingCard) return;
    const atualizado: CartaoCredito = { ...editingCard, nome: cardName.trim() || editingCard.nome, limite: cardLimit ? parseFloat(cardLimit) : undefined, diaVencimento: parseInt(cardDueDay || '15') } as any;
    try {
      setIsSubmittingEditCard(true);
      await saveCartao(atualizado);
      setCartoes((prev: CartaoCredito[]) => prev.map(c => c.id === atualizado.id ? atualizado : c));
      setIsEditCardDialogOpen(false);
      setEditingCard(null);
      setCardName(''); setCardLimit('');
    } catch (e) {
      alert('Não foi possível salvar o cartão.');
    }
    setIsSubmittingEditCard(false);
  };

  const [isSubmittingEditPurchase, setIsSubmittingEditPurchase] = useState(false);
  const handleSaveEditPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEditPurchase) return;
    if (!editingPurchase || !selectedCardId) return;
    
    const startMonth = purchaseStartDate.slice(0,7);
    const selectedCard = (cartoes as CartaoCredito[]).find(c => c.id === selectedCardId);
    const startDay = selectedCard?.diaVencimento || 5;
    
    const parcelasPagas = purchaseEmAndamento ? Math.max(0, parseInt(purchaseParcelaAtual) - 1) : 0;
    
    const atualizado: CompraCartao = {
      ...editingPurchase,
      descricao: purchaseDesc,
      valorTotal: parseFloat(purchaseValorTotal),
      parcelas: parseInt(purchaseParcelas || '1'),
      valorParcela: parseFloat(purchaseValorParcela),
      startMonth,
      dataCompra: purchaseDate,
      parcelasPagas: parcelasPagas,
      startDay,
    } as any;
    
    try {
      setIsSubmittingEditPurchase(true);
      await saveCompraCartao(atualizado);
      setComprasCartao((prev: CompraCartao[]) => prev.map(p => p.id === atualizado.id ? atualizado : p));
      setIsEditPurchaseDialogOpen(false);
      setEditingPurchase(null);
      setPurchaseDesc(''); setPurchaseValorTotal(''); setPurchaseParcelas('1'); setPurchaseValorParcela('');
      setPurchaseEmAndamento(false); setPurchaseParcelaAtual('');
    } catch (e) {
      alert('Não foi possível salvar a compra.');
    }
    setIsSubmittingEditPurchase(false);
  };

  const handleEdit = (divida: Divida) => {
    try { scrollBeforeDialogRef.current = window.scrollY || 0; } catch {}
    setEditingDivida(divida);
    
    // Se for compra de cartão, buscar dados originais
    if (divida.id.startsWith('purchase:')) {
      const purchaseId = divida.id.replace('purchase:', '');
      
      const compraOriginal = (comprasCartao as CompraCartao[]).find(p => p.id === purchaseId);
      
      if (compraOriginal) {
        const formDataToSet = {
          descricao: compraOriginal.descricao,
          valorTotal: compraOriginal.valorTotal.toString(),
          parcelas: compraOriginal.parcelas.toString(),
          valorParcela: compraOriginal.valorParcela.toString(),
          dataVencimento: `${compraOriginal.startMonth}-${String(compraOriginal.startDay || 5).padStart(2, '0')}`,
          tipo: compraOriginal.parcelas > 1 ? 'parcelada' : 'total',
          categoria: 'Cartão de Crédito',
          emAndamento: (compraOriginal.parcelasPagas || 0) > 0,
          parcelaAtual: (compraOriginal.parcelasPagas || 0) > 0 ? ((compraOriginal.parcelasPagas || 0) + 1).toString() : '',
          dataUltimoPagamento: ''
        };
        
        setFormData(formDataToSet);
      } else {
    setFormData({
      descricao: divida.descricao,
      valorTotal: divida.valorTotal.toString(),
      parcelas: divida.parcelas.toString(),
      valorParcela: divida.valorParcela.toString(),
          dataVencimento: new Date(divida.dataVencimento + 'T00:00:00').toISOString().split('T')[0],
      tipo: divida.tipo,
          categoria: (divida as any).categoria || 'Esporádicos',
          emAndamento: divida.parcelasPagas > 0,
          parcelaAtual: divida.parcelasPagas > 0 ? (divida.parcelasPagas + 1).toString() : '',
          dataUltimoPagamento: ''
        });
      }
    } else {
      setFormData({
        descricao: divida.descricao,
        valorTotal: divida.valorTotal.toString(),
        parcelas: divida.parcelas.toString(),
        valorParcela: divida.valorParcela.toString(),
        dataVencimento: new Date(divida.dataVencimento + 'T00:00:00').toISOString().split('T')[0],
        tipo: divida.tipo,
        categoria: (divida as any).categoria || 'Esporádicos',
        emAndamento: divida.parcelasPagas > 0,
        parcelaAtual: divida.parcelasPagas > 0 ? (divida.parcelasPagas + 1).toString() : '',
        dataUltimoPagamento: ''
      });
    }
    
    setIsDialogOpen(true);
  };



  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    // Caso seja uma compra de cartão mapeada como dívida
    if (id.startsWith('purchase:')) {
      const purchaseId = id.replace('purchase:', '');
      const compra = (comprasCartao as CompraCartao[]).find(p => p.id === purchaseId);
      if (!compra) return;
      try {
        // As transações serão revertidas automaticamente pelo useEffect
        await (context as any).deleteCompraCartao(purchaseId);
        setComprasCartao((prev: CompraCartao[]) => prev.filter(p => p.id !== purchaseId));
        
        // remover gastos fixos vinculados
      } catch (e) {
        alert('Não foi possível excluir a compra do cartão.');
      }
      return;
    }

    // Dívida normal
    try {
      // As transações serão revertidas automaticamente pelo useEffect
      await deleteDivida(id);
      setDividas(prev => prev.filter(d => d.id !== id));
      
    } catch (e) {
      alert('Não foi possível excluir a dívida.');
    }
  };

  const handlePagamento = (divida: Divida) => {
    // Verificar se é uma compra de cartão mapeada como dívida
    if (divida.id.startsWith('purchase:')) {
      const purchaseId = divida.id.replace('purchase:', '');
      const compra = (comprasCartao as CompraCartao[]).find(p => p.id === purchaseId);
      
      if (compra) {
        return handlePagamentoCompra(compra);
      }
    }
    
    setDividaSelecionada(divida);
    setCompraSelecionada(null);
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setModoPagamento('pay');
    
    // Preencher automaticamente com o valor da parcela do mês
    setTimeout(() => {
      try {
        const valorParcelaMes = getMonthlyDue(divida);
        setValorPagamentoInput(valorParcelaMes > 0 ? valorParcelaMes.toFixed(2).replace('.', ',') : '');
      } catch { 
        setValorPagamentoInput(''); 
      }
    }, 50);
    
    setIsPagamentoOpen(true);
  };

  const handlePagamentoCompra = (compra: CompraCartao) => {
    setCompraSelecionada(compra);
    setDividaSelecionada(null);
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setModoPagamento('pay');
    // Inicializar data e hora do pagamento
    setDataPagamento(new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'));
    setHoraPagamento(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }));
    
    // Preencher automaticamente com o valor da parcela do mês
    setTimeout(() => {
      try {
        const [sy, sm] = compra.startMonth.split('-').map(Number);
        const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
        const valor = purchaseInstallmentValue(compra, Math.max(0, Math.min((compra.parcelas || 1) - 1, idx)));
        setValorPagamentoInput(valor > 0 ? valor.toFixed(2).replace('.', ',') : '');
      } catch { 
        setValorPagamentoInput(''); 
      }
    }, 50);
    
    setIsPagamentoOpen(true);
  };

  const handlePagamentoCartao = (cartao: CartaoCredito) => {
    // Criar uma dívida temporária para o cartão
    const dividaTemporaria: Divida = {
      id: `card:${cartao.id}`,
      descricao: `Fatura ${cartao.nome}`,
      valorTotal: cardInvoiceTotalForSelectedMonth(cartao.id),
      valorPago: 0,
      parcelas: 1,
      dataVencimento: `${selectedYM.y}-${String(selectedYM.m).padStart(2, '0')}-${String(cartao.diaVencimento || 5).padStart(2, '0')}`,
      tipo: 'total' as const,
      categoria: 'Cartão de Crédito',
      emAndamento: false,
      parcelaAtual: '',
      dataUltimoPagamento: '',
      pago: false
    };
    
    setDividaSelecionada(dividaTemporaria);
    setCompraSelecionada(null);
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setModoPagamento('pay');
    
    // Sugerir valor da fatura do mês
    const valorFatura = cardInvoiceTotalForSelectedMonth(cartao.id);
    setValorPagamentoInput(String(valorFatura.toFixed(2)).replace('.', ','));
    
    // Scroll para o topo se mobile
    try {
      setTimeout(() => {
        if (window.innerWidth < 768) {
          window.scrollTo(0, 0);
        }
      }, 50);
    } catch {}
    
    setIsPagamentoOpen(true);
  };

  const handleEstorno = (divida: Divida) => {
    if ((divida.valorPago || 0) === 0) {
      alert('Não há pagamentos para estornar.');
      return;
    }
    
    // Verificar se é uma compra de cartão mapeada como dívida
    if (divida.id.startsWith('purchase:')) {
      const purchaseId = divida.id.replace('purchase:', '');
      const compra = (comprasCartao as CompraCartao[]).find(p => p.id === purchaseId);
      
      if (compra) {
        return handleEstornoCompra(compra);
      }
    }
    
    setDividaSelecionada(divida);
    setCompraSelecionada(null);
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setModoPagamento('refund');
    // Inicializar data e hora do pagamento
    setDataPagamento(new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'));
    setHoraPagamento(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }));
    // Sugerir valor do último pagamento
    setValorPagamentoInput(String((divida.valorPago || 0).toFixed(2)).replace('.', ','));
    setIsPagamentoOpen(true);
  };

  const handleEstornoCompra = (compra: CompraCartao) => {
    if (((compra as any).valorPago || 0) === 0) {
      alert('Não há pagamentos para estornar.');
      return;
    }
    setCompraSelecionada(compra);
    setDividaSelecionada(null);
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setModoPagamento('refund');
    // Sugerir valor do último pagamento
    setValorPagamentoInput(String(((compra as any).valorPago || 0).toFixed(2)).replace('.', ','));
    setIsPagamentoOpen(true);
  };

  const confirmarPagamento = async (e?: React.MouseEvent) => {
    // Prevenir comportamento padrão e propagação
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Verificação síncrona usando ref para evitar duplo clique
    if (isSavingRef.current) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    
    // Definir lock IMEDIATAMENTE
    isSavingRef.current = true;
    setIsSaving(true);
    
    try {
      if (!dividaSelecionada && !compraSelecionada) {
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }
      
      if (!caixaPagamento) { 
        alert('Selecione um caixa.'); 
        isSavingRef.current = false;
        setIsSaving(false);
        return; 
      }
      
      const valorPagamento = parseFloat(valorPagamentoInput.replace(',', '.'));
      if (isNaN(valorPagamento) || valorPagamento <= 0) {
        alert('Valor inválido.');
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }

      const c = (caixas || []).find((x: any) => x.id === caixaPagamento);
      if (c && c.saldo < valorPagamento) { 
        alert('Saldo insuficiente no caixa selecionado.'); 
        isSavingRef.current = false;
        setIsSaving(false);
        return; 
      }

      if (dividaSelecionada) {
        // Atualizar dívida
        const dividaAtual = dividas.find(d => d.id === dividaSelecionada.id);
        if (!dividaAtual) {
          isSavingRef.current = false;
          setIsSaving(false);
          return;
        }

        // Verificar duplicatas ANTES de fazer qualquer operação
        const descricaoTransacao = `Pagamento dívida: ${dividaAtual.descricao}`;
        const dataTransacao = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
        const horaTransacao = new Date().toTimeString().slice(0,5);
        
        // Criar chave única para esta transação
        const transacaoKey = `${descricaoTransacao}-${valorPagamento}-${caixaPagamento}-${dataTransacao}-${horaTransacao}`;
        
        // Verificar se já está sendo criada
        if (transacoesEmCriacaoRef.current.has(transacaoKey)) {
          isSavingRef.current = false;
          setIsSaving(false);
          return;
        }
        
        // Verificar se já existe no banco
        const transacoesRecentes = (transacoes || []).filter((t: any) => {
          const mesmaDescricao = t.descricao === descricaoTransacao;
          const mesmoValor = Math.abs(t.valor - valorPagamento) < 0.01;
          const mesmoCaixa = t.caixaId === caixaPagamento;
          const mesmaData = t.data === dataTransacao;
          const mesmaHora = t.hora === horaTransacao;
          return mesmaDescricao && mesmoValor && mesmoCaixa && mesmaData && mesmaHora;
        });

        // Se já existe transação idêntica, não continuar
        if (transacoesRecentes.length > 0) {
          isSavingRef.current = false;
          setIsSaving(false);
          return;
        }
        
        // Marcar como em criação
        transacoesEmCriacaoRef.current.add(transacaoKey);

        const novoValorPago = (dividaAtual.valorPago || 0) + valorPagamento;
        
        const atualizada: Divida = {
          ...dividaAtual,
          valorPago: novoValorPago,
          parcelasPagas: dividaAtual.parcelasPagas || 0,
        };

        await saveDivida(atualizada);
        // Para dívidas parceladas, deixar o listener atualizar para evitar duplicação
        if (atualizada.tipo !== 'parcelada' || atualizada.parcelas === 1) {
          setDividas(prev => prev.map(d => d.id === atualizada.id ? atualizada : d));
        }

        // Criar transação com ID único baseado em timestamp + dados
        if (saveTransacao) {
          const transactionId = `${Date.now()}-${dividaAtual.id}-${valorPagamento}`;
          await saveTransacao({
            id: transactionId,
            caixaId: caixaPagamento,
            tipo: 'saida',
            valor: valorPagamento,
            descricao: descricaoTransacao,
            categoria: 'Dívidas',
            data: dataTransacao,
            hora: horaTransacao
          });
        }

        const cx = (caixas || []).find((x: any) => x.id === caixaPagamento);
        if (cx) {
          await (saveCaixa && (saveCaixa as any)({ ...cx, saldo: cx.saldo - valorPagamento }));
        }
        
        // Remover da lista de transações em criação após 3 segundos
        setTimeout(() => {
          transacoesEmCriacaoRef.current.delete(transacaoKey);
        }, 3000);
      }

      if (compraSelecionada) {
        // Atualizar compra
        const compra = comprasCartao.find((p: CompraCartao) => p.id === compraSelecionada.id);
        if (!compra) {
          isSavingRef.current = false;
          setIsSaving(false);
          return;
        }

        const novoValorPago = ((compra as any).valorPago || 0) + valorPagamento;
        
        const atualizada = { 
          ...compra, 
          valorPago: novoValorPago,
          parcelasPagas: compra.parcelasPagas || 0,
        } as CompraCartao;
        
        await saveCompraCartao(atualizada);
        setComprasCartao((prev: CompraCartao[]) => prev.map(p => p.id === atualizada.id ? atualizada : p));

        await (saveTransacao && saveTransacao({
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'saida',
          valor: valorPagamento,
          descricao: `Pagamento cartão: ${compra.descricao}`,
          categoria: 'Dívidas',
          data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
          hora: new Date().toTimeString().slice(0,5)
        }));

        // Debitar o caixa
        const cx = (caixas || []).find((x: any) => x.id === caixaPagamento);
        if (cx) {
          await (saveCaixa && (saveCaixa as any)({ ...cx, saldo: cx.saldo - valorPagamento }));
        }
      }

      // Pagamento de cartão (dívida temporária)
      if (dividaSelecionada && dividaSelecionada.id.startsWith('card:')) {
        const cardId = dividaSelecionada.id.replace('card:', '');
        
        // Encontrar TODAS as compras do cartão
        const todasComprasDoCartao = (comprasCartao as CompraCartao[])
          .filter(p => p.cardId === cardId);
        
        // Atualizar todas as compras do cartão: calcular parcelas pagas baseado no mês atual
        for (const compra of todasComprasDoCartao) {
          const totalParcelas = compra.parcelas || 1;
          
          // Calcular qual parcela corresponde ao mês selecionado
          const [sy, sm] = compra.startMonth.split('-').map(Number);
          const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
          
          // Se a compra tem parcela no mês selecionado, atualizar parcelasPagas para idx + 1
          // (idx é 0-based, então a parcela do mês é idx + 1)
          let novasParcelasPagas = compra.parcelasPagas || 0;
          if (idx >= 0 && idx < totalParcelas) {
            // Atualizar parcelasPagas para pelo menos a parcela do mês atual
            novasParcelasPagas = Math.max(novasParcelasPagas, idx + 1);
          }
          
          // Calcular o valor pago até a parcela atual (incluindo)
          let valorPagoAteParcelaAtual = 0;
          for (let i = 0; i <= idx && i < totalParcelas; i++) {
            valorPagoAteParcelaAtual += purchaseInstallmentValue(compra, i);
          }
          
          // Atualizar compra com valorPago baseado nas parcelas pagas e parcelasPagas atualizado
          const compraAtualizada = {
            ...compra,
            valorPago: Math.max(compra.valorPago || 0, valorPagoAteParcelaAtual),
            parcelasPagas: novasParcelasPagas
          } as CompraCartao;
          
          await saveCompraCartao(compraAtualizada);
          setComprasCartao((prev: CompraCartao[]) => prev.map(p => p.id === compraAtualizada.id ? compraAtualizada : p));
        }
        
        // Criar transação
        await (saveTransacao && saveTransacao({
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'saida',
          valor: valorPagamento,
          descricao: `Pagamento fatura: ${dividaSelecionada.descricao}`,
          categoria: 'Cartão de Crédito',
          data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
          hora: new Date().toTimeString().slice(0,5)
        }));

        // Atualizar saldo do caixa
        const cx = (caixas || []).find((x: any) => x.id === caixaPagamento);
        if (cx) {
          await (saveCaixa && (saveCaixa as any)({ ...cx, saldo: cx.saldo - valorPagamento }));
        }
      }

      // Fechar modal e limpar apenas após TODAS as operações completarem
      setIsPagamentoOpen(false);
      setDividaSelecionada(null);
      setCompraSelecionada(null);
      setValorPagamentoInput('');
      setDataPagamento('');
      setHoraPagamento('');
    } catch (error: any) {
      alert('Erro ao processar pagamento: ' + (error.message || error));
      // Em caso de erro, NÃO fechar o modal para o usuário poder tentar novamente
      // Limpar qualquer transação em criação em caso de erro
      transacoesEmCriacaoRef.current.clear();
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const confirmarEstorno = async (e?: React.MouseEvent) => {
    // Prevenir comportamento padrão e propagação
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Verificação síncrona usando ref para evitar duplo clique
    if (isSavingRef.current) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    
    // Definir lock IMEDIATAMENTE
    isSavingRef.current = true;
    setIsSaving(true);
    
    try {
      if (!dividaSelecionada && !compraSelecionada) {
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }
      
      if (!caixaPagamento) { 
        alert('Selecione um caixa.'); 
        isSavingRef.current = false;
        setIsSaving(false);
        return; 
      }
      
      const valorPagamento = parseFloat(valorPagamentoInput.replace(',', '.'));
      if (isNaN(valorPagamento) || valorPagamento <= 0) {
        alert('Valor inválido.');
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }

      if (dividaSelecionada) {
        // Atualizar dívida (reverter pagamento)
        const dividaAtual = dividas.find(d => d.id === dividaSelecionada.id);
        if (!dividaAtual) {
          isSavingRef.current = false;
          setIsSaving(false);
          return;
        }

        const novoValorPago = Math.max(0, (dividaAtual.valorPago || 0) - valorPagamento);
        
        const atualizada: Divida = {
          ...dividaAtual,
          valorPago: novoValorPago,
          parcelasPagas: dividaAtual.parcelasPagas || 0,
        };

        await saveDivida(atualizada);
        // Para dívidas parceladas, deixar o listener atualizar para evitar duplicação
        if (atualizada.tipo !== 'parcelada' || atualizada.parcelas === 1) {
          setDividas(prev => prev.map(d => d.id === atualizada.id ? atualizada : d));
        }

        // Criar transação de estorno
        await (saveTransacao && saveTransacao({
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'entrada',
          valor: valorPagamento,
          descricao: `Estorno dívida: ${dividaAtual.descricao}`,
          categoria: 'Dívidas',
          data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
          hora: new Date().toTimeString().slice(0,5)
        }));

        // Creditar o caixa
        const cx = (caixas || []).find((x: any) => x.id === caixaPagamento);
        if (cx) {
          await (saveCaixa && (saveCaixa as any)({ ...cx, saldo: cx.saldo + valorPagamento }));
        }
      }

      if (compraSelecionada) {
        // Atualizar compra (reverter pagamento)
        const compra = comprasCartao.find((p: CompraCartao) => p.id === compraSelecionada.id);
        if (!compra) {
          isSavingRef.current = false;
          setIsSaving(false);
          return;
        }

        const novoValorPago = Math.max(0, ((compra as any).valorPago || 0) - valorPagamento);
        
        const atualizada = { 
          ...compra, 
          valorPago: novoValorPago,
          parcelasPagas: compra.parcelasPagas || 0,
        } as CompraCartao;
        
        await saveCompraCartao(atualizada);
        setComprasCartao((prev: CompraCartao[]) => prev.map(p => p.id === atualizada.id ? atualizada : p));

        // Criar transação de estorno
        await (saveTransacao && saveTransacao({
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'entrada',
          valor: valorPagamento,
          descricao: `Estorno cartão: ${compra.descricao}`,
          categoria: 'Dívidas',
          data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
          hora: new Date().toTimeString().slice(0,5)
        }));

        // Creditar o caixa
        const cx = (caixas || []).find((x: any) => x.id === caixaPagamento);
        if (cx) {
          await (saveCaixa && (saveCaixa as any)({ ...cx, saldo: cx.saldo + valorPagamento }));
        }
      }

      // Fechar modal e limpar apenas após TODAS as operações completarem
      setIsPagamentoOpen(false);
      setDividaSelecionada(null);
      setCompraSelecionada(null);
      setDataPagamento('');
      setHoraPagamento('');
      setValorPagamentoInput('');
    } catch (error: any) {
      alert('Erro ao processar estorno: ' + (error.message || error));
      // Em caso de erro, NÃO fechar o modal para o usuário poder tentar novamente
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const processarPagamento = async (valorPagamento: number) => {
    // Evitar duplo clique
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      if (!dividaSelecionada && !compraSelecionada) return;
      if (!caixaPagamento) { 
        alert('Selecione um caixa.'); 
        return; 
      }
      // Bloqueio de saldo negativo
      const c = (caixas || []).find((x: any) => x.id === caixaPagamento);
      if (c && c.saldo < valorPagamento) { alert('Saldo insuficiente no caixa selecionado.'); return; }

    if (dividaSelecionada) {
      // Verificar se é pagamento de cartão (dívida temporária)
      if (dividaSelecionada.id.startsWith('card:')) {
        const cardId = dividaSelecionada.id.replace('card:', '');
        
        // Criar transação para pagamento da fatura
        try {
          await (saveTransacao && saveTransacao({
            id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
            caixaId: caixaPagamento,
            tipo: 'saida',
            valor: valorPagamento,
            descricao: `Pagamento fatura: ${dividaSelecionada.descricao}`,
            categoria: 'Cartão de Crédito',
            data: dataPagamento || new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
            hora: horaPagamento || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
          }));

          // Debitar o caixa
          const cx = (caixas || []).find((x: any) => x.id === caixaPagamento);
          if (cx) {
            await (saveCaixa && (saveCaixa as any)({ ...cx, saldo: cx.saldo - valorPagamento }));
          }

          // Atualizar parcelas pagas das compras do cartão para o mês atual
          const comprasDoCartao = (comprasCartao as CompraCartao[]).filter(p => p.cardId === cardId);
          
          for (const compra of comprasDoCartao) {
            const [sy, sm] = compra.startMonth.split('-').map(Number);
            const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
            
            // Se a compra tem parcela neste mês, avançar +1 parcela
            if (idx >= 0 && idx < compra.parcelas) {
              const parcelasAtuais = compra.parcelasPagas || 0;
              const novasParcelasPagas = parcelasAtuais + 1;
              
              const compraAtualizada = { ...compra, parcelasPagas: novasParcelasPagas };
              
              await saveCompraCartao(compraAtualizada);
              setComprasCartao((prev: CompraCartao[]) => 
                prev.map(p => p.id === compraAtualizada.id ? compraAtualizada : p)
              );
            }
          }
        } catch (_error) {
          console.error('Erro ao processar pagamento do cartão');
          alert('Erro ao processar pagamento: ' + (_error as any).message);
          return;
        }
      } else {
        // Pagamento de dívida normal
        const dividaAtual = dividas.find(d => d.id === dividaSelecionada.id);
        if (!dividaAtual) return;

      const novoValorPago = (dividaAtual.valorPago || 0) + valorPagamento;
      const valorParcela = dividaAtual.valorParcela || (dividaAtual.valorTotal / (dividaAtual.parcelas || 1));
      const novasParcelasPagas = dividaAtual.tipo === 'parcelada' 
        ? Math.floor(novoValorPago / valorParcela)
        : novoValorPago >= dividaAtual.valorTotal ? 1 : 0;

      const atualizada: Divida = {
        ...dividaAtual,
        valorPago: novoValorPago,
        parcelasPagas: Math.min(novasParcelasPagas, dividaAtual.parcelas || 1),
      };

      await saveDivida(atualizada);
      setDividas(prev => prev.map(d => d.id === atualizada.id ? atualizada : d));

      // registrar saída no caixa selecionado
      try {
        await (saveTransacao && saveTransacao({
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'saida',
          valor: valorPagamento,
          descricao: `Pagamento dívida: ${dividaAtual.descricao}`,
          categoria: 'Dívidas',
          data: dataPagamento || new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
          hora: horaPagamento || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
        }));

        // Debitar o caixa
        const cx = (caixas || []).find((x: any) => x.id === caixaPagamento);
        if (cx) {
          await (saveCaixa && (saveCaixa as any)({ ...cx, saldo: cx.saldo - valorPagamento }));
        }
      } catch {}

      }
    }

    if (compraSelecionada) {
      const compra = comprasCartao.find((p: CompraCartao) => p.id === compraSelecionada.id);
      if (!compra) return;
      // avançar a competência paga até o mês selecionado
      const [sy, sm] = compra.startMonth.split('-').map(Number);
      const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
      const novasPagas = Math.max(compra.parcelasPagas || 0, Math.min(compra.parcelas, idx + 1));
      const atualizada = { ...compra, parcelasPagas: novasPagas } as CompraCartao;
      await saveCompraCartao(atualizada);
      setComprasCartao((prev: CompraCartao[]) => prev.map(p => p.id === atualizada.id ? atualizada : p));

      try {
        await (saveTransacao && saveTransacao({
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'saida',
          valor: valorPagamento,
          descricao: `Pagamento cartão: ${compra.descricao}`,
          categoria: 'Dívidas',
          data: dataPagamento || new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
          hora: horaPagamento || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
        }));

        // Debitar o caixa
        const cx = (caixas || []).find((x: any) => x.id === caixaPagamento);
        if (cx) {
          await (saveCaixa && (saveCaixa as any)({ ...cx, saldo: cx.saldo - valorPagamento }));
        }
      } catch {}

    }

    setIsPagamentoOpen(false);
    setDividaSelecionada(null);
    setCompraSelecionada(null);
    setDataPagamento('');
    setHoraPagamento('');
    setValorPagamentoInput('');
  } finally {
    isSavingRef.current = false;
    setIsSaving(false);
  }
  };

  // Helpers de competência mensal
  // Manipulação robusta de ano/mês sem normalização de datas do JS
  const ymToIndex = (year: number, month1to12: number) => year * 12 + (month1to12 - 1);
  const parseYYYYMM = (s: string) => {
    const [y, m] = s.split('-').map(Number);
    return { y, m };
  };
  const parseYYYYMMDDtoYM = (s: string) => {
    const [y, m] = s.split('-').slice(0, 2).map(Number);
    return { y, m };
  };
  const selectedYM = useMemo(() => parseYYYYMM(selectedMonth), [selectedMonth]);

  // Monitorar exclusão de transações de pagamento de fatura
  useEffect(() => {
    const transacoesFatura = (transacoes || []).filter(t => 
      t.descricao.includes('Pagamento fatura:') && t.categoria === 'Cartão de Crédito'
    );
    
    // Se não há transações de fatura, reverter apenas compras que foram afetadas pelo pagamento da fatura
    if (transacoesFatura.length === 0) {
      const comprasParaReverter = (comprasCartao as CompraCartao[]).filter(compra => {
        const [sy, sm] = compra.startMonth.split('-').map(Number);
        const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
        // Só reverter se a compra tem parcela neste mês E não está marcada como "em andamento"
        return idx >= 0 && idx < compra.parcelas && (compra.parcelasPagas || 0) > 0 && !compra.emAndamento;
      });
      
      comprasParaReverter.forEach(async (compra) => {
        const parcelasAtuais = compra.parcelasPagas || 0;
        const novasParcelasPagas = Math.max(0, parcelasAtuais - 1);
        
        if (novasParcelasPagas !== parcelasAtuais) {
          const compraAtualizada = { ...compra, parcelasPagas: novasParcelasPagas };
          await saveCompraCartao(compraAtualizada);
          setComprasCartao((prev: CompraCartao[]) => 
            prev.map(p => p.id === compraAtualizada.id ? compraAtualizada : p)
          );
        }
      });
    }
  }, [transacoes, selectedYM]);

  const getMonthlyDue = (d: Divida): number => {
    if (d.tipo === 'parcelada') {
      const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
      const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
      if (idx < 0 || idx >= d.parcelas) return 0;
      const base = d.valorParcela;
      const delta = Math.round(d.valorTotal * 100) - Math.round(base * 100) * d.parcelas;
      const isLast = idx === d.parcelas - 1;
      const valor = base + (isLast ? delta / 100 : 0);
      return Math.max(0, valor);
    }
    return d.valorTotal;
  };

  const purchaseInstallmentValue = (compra: CompraCartao, index: number): number => {
    const base = compra.valorParcela;
    const delta = Math.round(compra.valorTotal * 100) - Math.round(base * 100) * compra.parcelas;
    const isLast = index === compra.parcelas - 1;
    return base + (isLast ? delta / 100 : 0);
  };

  const getParcelaDoMes = (divida: Divida) => {
    if (divida.tipo !== 'parcelada') return null;
    
    // PRIORIDADE 1: Usar parcelaIndex diretamente do documento (mais confiável)
    if (divida.parcelaIndex !== undefined && divida.parcelaIndex >= 1) {
      return divida.parcelaIndex;
    }
    
    // PRIORIDADE 2: Se tem parcelaTotal, usar parcelaIndex se existir
    if (divida.parcelaTotal !== undefined && divida.parcelaIndex !== undefined) {
      return divida.parcelaIndex;
    }
    
    // FALLBACK: Calcular baseado em parcelasPagas (compatibilidade com dados antigos)
    const parcelaAtual = (divida.parcelasPagas || 0) + 1;
    if (parcelaAtual < 1 || parcelaAtual > divida.parcelas) return null;
    return parcelaAtual;
  };

  const getParcelaCompraDoMes = (compra: CompraCartao) => {
    const parcelaAtual = (compra.parcelasPagas || 0) + 1;
    if (parcelaAtual < 1 || parcelaAtual > compra.parcelas) return null;
    return parcelaAtual;
  };

  const getStatusCartao = (cardId: string) => {
    const comprasDoCartao = (comprasCartao as CompraCartao[]).filter(p => p.cardId === cardId);
    if (comprasDoCartao.length === 0) {
      return { status: 'Sem compras', cor: 'text-muted-foreground' };
    }
    const comprasDoMes = comprasDoCartao.filter(compra => {
      const [sy, sm] = compra.startMonth.split('-').map(Number);
      const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
      return idx >= 0 && idx < compra.parcelas;
    });
    if (comprasDoMes.length === 0) {
      return { status: 'Sem parcelas este mês', cor: 'text-muted-foreground' };
    }
    
    // Verificar se existe transação de pagamento da fatura no mês selecionado
    const cartao = (cartoes || []).find((c: any) => c.id === cardId);
    const nomeCartao = cartao?.nome || '';
    const transacoesFatura = (transacoes || []).filter(t => 
      t.descricao.includes(`Fatura ${nomeCartao}`) ||
      t.descricao.includes(`Pagamento fatura: ${nomeCartao}`) ||
      t.descricao.includes(`Pagamento fatura: Fatura ${nomeCartao}`)
    );
    const mesAtual = `${selectedYM.y}-${String(selectedYM.m).padStart(2, '0')}`;
    const transacaoFaturaMes = transacoesFatura.find(t => 
      t.data.startsWith(mesAtual)
    );
    if (transacaoFaturaMes) {
      return { status: '✓ Pago', cor: 'text-green-600' };
    }
    
    return { status: '⏳ Pendente', cor: 'text-red-600' };
  };

  // Função para calcular percentual de progresso baseado em PARCELAS (parcelaIndex)
  const getPercentualProgresso = (divida: Divida): number => {
    // Para dívidas parceladas com parcelaIndex, usar parcelaIndex como base
    if (divida.tipo === 'parcelada' && divida.parcelaIndex !== undefined && divida.parcelaTotal !== undefined) {
      // Se está na parcela 8 de 12, significa que 7 parcelas já passaram (1-7)
      const parcelasJaPassaram = divida.parcelaIndex - 1;
      const totalParcelas = divida.parcelaTotal;
      return totalParcelas > 0 ? (parcelasJaPassaram / totalParcelas) * 100 : 0;
    }
    
    // Fallback: usar parcelasPagas se não tiver parcelaIndex
    if (divida.tipo === 'parcelada' && divida.parcelas > 1) {
      const parcelasPagas = divida.parcelasPagas || 0;
      const totalParcelas = divida.parcelas || 1;
      return totalParcelas > 0 ? (parcelasPagas / totalParcelas) * 100 : 0;
    }
    
    // Para dívidas à vista (tipo 'total'), usar valor
    const valorPago = divida.valorPago || 0;
    const valorTotal = divida.valorTotal || 0;
    return valorTotal > 0 ? (valorPago / valorTotal) * 100 : 0;
  };

  // Função para calcular valor restante baseado em parcelasPagas (não transações)
  const getValorRestante = (divida: Divida): number => {
    // Para dívidas parceladas com parcelaIndex, calcular baseado nas parcelas restantes
    if (divida.tipo === 'parcelada' && divida.parcelaIndex !== undefined && divida.parcelaTotal !== undefined) {
      const parcelaIndex = divida.parcelaIndex;
      const parcelaTotal = divida.parcelaTotal;
      const parcelasJaPassaram = parcelaIndex - 1; // Parcelas que já passaram (1 a parcelaIndex-1)
      const valorParcela = divida.valorParcela || (divida.valorTotal / parcelaTotal);
      
      // Calcular valor já "consumido" pelas parcelas que passaram
      const valorJaPassou = valorParcela * parcelasJaPassaram;
      
      // Valor restante = valor total - valor já passou
      const restante = divida.valorTotal - valorJaPassou;
      
      // Garantir que não seja negativo e considerar ajustes de centavos
      return Math.max(0, Math.round(restante * 100) / 100);
    }
    
    // Para dívidas parceladas sem parcelaIndex: usar parcelasPagas
    if (divida.tipo === 'parcelada' && divida.parcelas > 1) {
      const parcelasPagas = divida.parcelasPagas || 0;
      const totalParcelas = divida.parcelas || 1;
      const valorParcela = divida.valorParcela || (divida.valorTotal / totalParcelas);
      const valorPago = parcelasPagas * valorParcela;
      
      // Se todas as parcelas foram pagas, incluir ajuste de centavos
      let valorPagoTotal = valorPago;
      if (parcelasPagas >= totalParcelas) {
        const ajusteCentavos = Math.round(divida.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
        valorPagoTotal = valorPago + ajusteCentavos / 100;
      }
      
      const restante = divida.valorTotal - valorPagoTotal;
      return Math.max(0, Math.round(restante * 100) / 100);
    }
    
    // Para dívidas à vista: usar valorPago
    return Math.max(0, divida.valorTotal - (divida.valorPago || 0));
  };

  const getStatusParcela = (divida: Divida) => {
    const valorPago = divida.valorPago || 0;
    const valorTotal = divida.valorTotal;
    const parcelasPagas = divida.parcelasPagas || 0;
    const totalParcelas = divida.parcelas || 1;
    
    if (divida.tipo === 'total') {
      if (valorPago === 0) return { status: 'Pendente', cor: 'text-red-600', bg: 'bg-red-50' };
      if (valorPago >= valorTotal) return { status: 'Pago', cor: 'text-green-600', bg: 'bg-green-50' };
      return { status: 'Pago Parcial', cor: 'text-orange-600', bg: 'bg-orange-50' };
    }
    
    // Para dívidas parceladas: comparar valorPago vs valorParcela (não usar transações)
    const valorParcela = divida.valorParcela || (valorTotal / totalParcelas);
    
    if (valorPago === 0) {
      return { status: 'Pendente', cor: 'text-red-600', bg: 'bg-red-50' };
    } else if (valorPago >= valorParcela) {
      return { status: 'Pago', cor: 'text-green-600', bg: 'bg-green-50' };
    } else {
      return { status: 'Pago Parcial', cor: 'text-orange-600', bg: 'bg-orange-50' };
    }
  };

  const getStatusCompra = (compra: CompraCartao) => {
    const valorPago = (compra as any).valorPago || 0;
    const valorTotal = compra.valorTotal;
    const parcelasPagas = (compra as any).parcelasPagas || 0;
    const totalParcelas = compra.parcelas || 1;
    
    if (totalParcelas === 1) {
      if (valorPago === 0) return { status: 'Pendente', cor: 'text-red-600', bg: 'bg-red-50' };
      if (valorPago >= valorTotal) return { status: 'Pago', cor: 'text-green-600', bg: 'bg-green-50' };
      return { status: 'Pago Parcial', cor: 'text-orange-600', bg: 'bg-orange-50' };
    }
    
    const [sy, sm] = compra.startMonth.split('-').map(Number);
    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
    const parcelaMes = idx >= 0 && idx < compra.parcelas ? purchaseInstallmentValue(compra, idx) : 0;
    const parcelaMesPaga = idx < (compra.parcelasPagas || 0) ? parcelaMes : 0;
    
    if (parcelaMesPaga >= parcelaMes && parcelaMes > 0) {
      return { status: 'Pago', cor: 'text-green-600', bg: 'bg-green-50' };
    } else if (parcelaMesPaga > 0 && parcelaMesPaga < parcelaMes) {
      return { status: 'Pago Parcial', cor: 'text-orange-600', bg: 'bg-orange-50' };
    } else {
      return { status: 'Pendente', cor: 'text-red-600', bg: 'bg-red-50' };
    }
  };

  const formatDateBR = (s: string) => {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  };
  
  const localDateFromYYYYMMDD = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const getInstallmentValue = (d: Divida, index: number): number => {
    if (d.tipo !== 'parcelada') return d.valorTotal;
    const base = d.valorParcela;
    const delta = Math.round(d.valorTotal * 100) - Math.round(base * 100) * d.parcelas;
    const isLast = index === d.parcelas - 1;
    return base + (isLast ? delta / 100 : 0);
  };

  const addMonths = (y: number, m1to12: number, add: number) => {
    const idx = ymToIndex(y, m1to12) + add;
    const ny = Math.floor(idx / 12);
    const nm = (idx % 12) + 1;
    return { y: ny, m: nm };
  };

  const getMonthlyPaid = (d: Divida): number => {
    if (d.pago) {
      const parcelaMes = getMonthlyDue(d);
      return parcelaMes;
    }
    
    // Para dívidas parceladas: usar parcelasPagas ao invés de transações
    if (d.tipo === 'parcelada') {
      const parcelasPagas = d.parcelasPagas || 0;
      const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
      const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
      if (idx < 0 || idx >= d.parcelas) return 0;
      
      // Se a parcela deste mês foi paga (idx < parcelasPagas), retornar valor da parcela
      if (idx < parcelasPagas) {
        const parcelaMes = getMonthlyDue(d);
        return parcelaMes;
      }
      
      return 0;
    }
    
    // Para dívidas à vista (tipo 'total'): usar valorPago diretamente
    const vencYM = parseYYYYMMDDtoYM(d.dataVencimento);
    if (vencYM.y === selectedYM.y && vencYM.m === selectedYM.m) {
      const valorPago = d.valorPago || 0;
      const valorDue = getMonthlyDue(d);
      // Se o valor pago é maior ou igual ao valor devido, retornar o valor devido
      if (valorPago >= valorDue) {
        return valorDue;
      }
      // Caso contrário, retornar o valor pago (pagamento parcial)
      return valorPago;
    }
    return 0;
  };

  const getMonthlyPaidCompra = (c: CompraCartao): number => {
    // Usar parcelasPagas ao invés de transações
    const parcelasPagas = c.parcelasPagas || 0;
    const totalParcelas = c.parcelas || 1;
    
    const [sy, sm] = c.startMonth.split('-').map(Number);
    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
    if (idx < 0 || idx >= totalParcelas) return 0;
    
    // Se a parcela deste mês foi paga (idx < parcelasPagas), retornar valor da parcela
    if (idx < parcelasPagas) {
      const parcelaMes = purchaseInstallmentValue(c, idx);
      return parcelaMes;
    }
    
    return 0;
  };

  const [anoSelecionado, mesSelecionado] = selectedMonth.split('-').map(Number);

  // Compras de cartão não são mais exibidas na lista de dívidas
  const { y: selY, m: selM } = selectedYM;

  const dividasFiltradas = dividas.filter((d) => {
    // Se tem período, usar ele diretamente (nova estrutura)
    if (d.periodo) {
      return d.periodo === selectedMonth;
    }
    
    // Compatibilidade: lógica antiga para dívidas sem período
    const quitYM = getQuitYM(d);
    if (quitYM && ((quitYM.y < selY) || (quitYM.y === selY && quitYM.m < selM))) {
      return false;
    }

    if (d.tipo === 'parcelada') {
      const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
      const idx = ymToIndex(selY, selM) - ymToIndex(startYM.y, startYM.m);
      return idx >= 0 && idx < d.parcelas;
    }

    const { y: y0, m: m0 } = parseYYYYMMDDtoYM(d.dataVencimento);
    return y0 === selY && m0 === selM;
  });

  // Deduplicação: agrupa por debtId ou características semânticas, mantém maior parcelaIndex
  const getGroupKey = (d: Divida): string => {
    if (d.debtId) {
      return `debtId:${d.debtId}-${d.periodo || 'sem-periodo'}`;
    }
    
    const descNormalizada = d.descricao.trim().toLowerCase();
    const valorTotalNormalizado = Math.round(d.valorTotal * 100);
    const parcelas = d.parcelas || 1;
    if (d.tipo === 'parcelada' && d.parcelaIndex !== undefined) {
      return `sem:${descNormalizada}-${valorTotalNormalizado}-${parcelas}-${d.periodo || 'sem-periodo'}`;
    }
    return `sem:${descNormalizada}-${valorTotalNormalizado}-${d.periodo || 'sem-periodo'}`;
  };
  
  const dividasPorGrupo = new Map<string, Divida[]>();
  dividasFiltradas.forEach((d) => {
    const chave = getGroupKey(d);
    if (!dividasPorGrupo.has(chave)) {
      dividasPorGrupo.set(chave, []);
    }
    dividasPorGrupo.get(chave)!.push(d);
  });
  
  const dividasUnicas = new Map<string, Divida>();
  dividasPorGrupo.forEach((grupo, chaveGrupo) => {
    if (grupo.length === 1) {
      dividasUnicas.set(chaveGrupo, grupo[0]);
      return;
    }
    grupo.sort((a, b) => {
      if (a.parcelaIndex !== undefined && b.parcelaIndex !== undefined) {
        const diff = b.parcelaIndex - a.parcelaIndex;
        if (diff !== 0) return diff;
      }
      const dataA = new Date(a.dataVencimento + 'T00:00:00').getTime();
      const dataB = new Date(b.dataVencimento + 'T00:00:00').getTime();
      return dataB - dataA;
    });
    dividasUnicas.set(chaveGrupo, grupo[0]);
  });
  
  const dividasFiltradasUnicas = Array.from(dividasUnicas.values());

  const allDividasForView: DividaView[] = dividasFiltradasUnicas.map((d) => {
    const original = new Date(d.dataVencimento + 'T00:00:00');
    const dia = original.getDate();
    const nova = new Date(anoSelecionado, mesSelecionado - 1, dia);
    return { ...d, dataVencimentoExibida: nova.toISOString().split('T')[0] };
  });

  const listDividasForMonth = allDividasForView.sort((a, b) => {
    const A = a.dataVencimentoExibida ?? a.dataVencimento;
    const B = b.dataVencimentoExibida ?? b.dataVencimento;
    return new Date(A).getTime() - new Date(B).getTime();
  });

  // Totais mensais usando utilitário compartilhado
  // Usar apenas as dívidas filtradas do mês selecionado (já filtradas por período)
  const { monthlyTotal, monthlyPaid, monthlyRemaining, monthlyCount } = calculateMonthlyTotals(
    dividasFiltradasUnicas,
    comprasCartao,
    cartoes,
    selectedMonth,
    transacoes
  );

  // Helpers para fatura do cartão
  const cardInvoiceTotalForSelectedMonth = (cardId: string): number => {
    return (comprasCartao as CompraCartao[])
      .filter(p => p.cardId === cardId)
      .reduce((sum, p) => {
        const [sy, sm] = p.startMonth.split('-').map(Number);
        const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
        if (idx < 0 || idx >= p.parcelas) return sum;
        return sum + purchaseInstallmentValue(p, idx);
      }, 0);
  };



  // Calcular totais das dívidas
  // Para dívidas distribuídas por mês (com parcelaIndex), cada parcela tem valorTotal = valorParcela
  // Precisamos agrupar por dívida base e calcular o valorTotal completo
  const dividasAgrupadas = new Map<string, Divida[]>();
  
  dividas.forEach((d) => {
    // Se tem parcelaIndex, usar um ID base sem o índice da parcela
    if (d.parcelaIndex !== undefined && d.parcelaTotal !== undefined) {
      // Extrair ID base (remover apenas o último segmento que é o índice da parcela)
      // O ID tem formato: {divida-id}-{parcelaIndex}
      const partes = d.id.split('-');
      const baseId = partes.slice(0, -1).join('-'); // Remove apenas o último segmento
      if (!dividasAgrupadas.has(baseId)) {
        dividasAgrupadas.set(baseId, []);
      }
      dividasAgrupadas.get(baseId)!.push(d);
    } else {
      // Dívida não distribuída
      dividasAgrupadas.set(d.id, [d]);
    }
  });
  
  const totalDividasNormais = Array.from(dividasAgrupadas.values()).reduce((sum, grupo) => {
    const primeiraDivida = grupo[0];
    // Se é dívida distribuída, calcular valorTotal completo: parcelaTotal * valorParcela
    if (primeiraDivida.parcelaIndex !== undefined && primeiraDivida.parcelaTotal !== undefined) {
      const valorParcela = primeiraDivida.valorParcela || primeiraDivida.valorTotal;
      const parcelaTotal = primeiraDivida.parcelaTotal;
      return sum + (valorParcela * parcelaTotal);
    }
    // Se não é distribuída, usar valorTotal diretamente
    return sum + (primeiraDivida.valorTotal || 0);
  }, 0);
  
  const totalPagoNormais = Array.from(dividasAgrupadas.values()).reduce((sum, grupo) => {
    // Pegar a primeira dívida do grupo (representa a dívida completa)
    const primeiraDivida = grupo[0];
    
    // Para dívidas parceladas: calcular baseado em parcelasPagas
    if (primeiraDivida.tipo === 'parcelada' && primeiraDivida.parcelas > 1) {
      const parcelasPagas = primeiraDivida.parcelasPagas || 0;
      const valorParcela = primeiraDivida.valorParcela || (primeiraDivida.valorTotal / primeiraDivida.parcelas);
      const valorPago = parcelasPagas * valorParcela;
      
      // Se todas as parcelas foram pagas, incluir ajuste de centavos
      if (parcelasPagas >= primeiraDivida.parcelas) {
        const ajusteCentavos = Math.round(primeiraDivida.valorTotal * 100) - Math.round(valorParcela * 100) * primeiraDivida.parcelas;
        return sum + (valorPago + ajusteCentavos / 100);
      }
      
      return sum + valorPago;
    }
    
    // Para dívidas à vista: usar valorPago diretamente
    return sum + (primeiraDivida.valorPago || 0);
  }, 0);
  
  // Calcular totais das faturas dos cartões (somar TODAS as parcelas de TODAS as compras)
  const totalFaturasCartao = (comprasCartao || []).reduce((sum, compra) => {
    return sum + (compra.valorTotal || 0);
  }, 0);
  
  // Calcular total pago das compras de cartão baseado em parcelas pagas
  const totalPagoCartao = (comprasCartao || []).reduce((sum, compra) => {
    const parcelasPagas = compra.parcelasPagas || 0;
    const totalParcelas = compra.parcelas || 1;
    const valorParcela = compra.valorParcela || (compra.valorTotal / totalParcelas);
    const valorPago = parcelasPagas * valorParcela;
    
    // Se todas as parcelas foram pagas, incluir ajuste de centavos
    if (parcelasPagas >= totalParcelas) {
      const ajusteCentavos = Math.round(compra.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
      return sum + (valorPago + ajusteCentavos / 100);
    }
    
    return sum + valorPago;
  }, 0);
  
  // Totais combinados
  const totalDividas = totalDividasNormais + totalFaturasCartao;
  const totalPago = totalPagoNormais + totalPagoCartao;
  
  // Calcular total restante somando todos os restantes individuais
  // Para dívidas: usar getValorRestante de cada dívida agrupada (representando a dívida completa)
  const totalRestanteDividas = Array.from(dividasAgrupadas.values()).reduce((sum, grupo) => {
    const primeiraDivida = grupo[0];
    // Calcular restante individual exatamente como na tabela
    const restante = getValorRestante(primeiraDivida);
    return sum + restante;
  }, 0);
  
  // Para compras de cartão: calcular restante individual de cada compra
  const totalRestanteCartao = (comprasCartao || []).reduce((sum, compra) => {
    const parcelasPagas = compra.parcelasPagas || 0;
    const totalParcelas = compra.parcelas || 1;
    const valorParcela = compra.valorParcela || (compra.valorTotal / totalParcelas);
    const valorPago = parcelasPagas * valorParcela;
    
    // Se todas as parcelas foram pagas, incluir ajuste de centavos
    let valorPagoTotal = valorPago;
    if (parcelasPagas >= totalParcelas) {
      const ajusteCentavos = Math.round(compra.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
      valorPagoTotal = valorPago + ajusteCentavos / 100;
    }
    
    const restante = Math.max(0, compra.valorTotal - valorPagoTotal);
    return sum + restante;
  }, 0);
  
  // Total restante = soma de todos os restantes individuais
  const totalRestante = totalRestanteDividas + totalRestanteCartao;

  // Dívidas próximas do vencimento (próximos 30 dias)
  const hoje = new Date();
  const proximoMes = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const dividasVencendoSoon = dividas.filter(divida => {
    const vencimento = localDateFromYYYYMMDD(divida.dataVencimento);
    return vencimento >= hoje && vencimento <= proximoMes && divida.valorPago < divida.valorTotal;
  });

  return (
    <div className="space-y-6">
      {/* Modal de pagamento */}
      <Dialog open={isPagamentoOpen} onOpenChange={setIsPagamentoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modoPagamento === 'pay' ? 'Pagar dívida' : 'Estornar dívida'}</DialogTitle>
            <DialogDescription>
              {dividaSelecionada?.descricao || compraSelecionada?.descricao}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valorPagamento">Valor do pagamento</Label>
              <Input
                id="valorPagamento"
                type="text"
                value={valorPagamentoInput}
                onChange={(e) => setValorPagamentoInput(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-sm text-muted-foreground">
                Sugestão (valor da parcela do mês): R$ {(() => {
                  if (dividaSelecionada) {
                    const valor = getMonthlyDue(dividaSelecionada);
                    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                  }
                  if (compraSelecionada) {
                    const [sy, sm] = compraSelecionada.startMonth.split('-').map(Number);
                    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
                    const valor = purchaseInstallmentValue(compraSelecionada, Math.max(0, Math.min((compraSelecionada.parcelas || 1) - 1, idx)));
                    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                  }
                  return '0,00';
                })()}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="caixaPagamento">Caixa para débito</Label>
              <Select value={caixaPagamento || ''} onValueChange={setCaixaPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o caixa" />
                </SelectTrigger>
                <SelectContent>
                  {caixas?.map((caixa: any) => {
                    // Saldo real do mês selecionado (igual ao usado em Transações/Dashboard)
                    const ym = selectedMonth;
                    const ymToIndex = (y: number, m: number) => y * 12 + (m - 1);
                    const parseYM = (s: string) => { const [yy, mm] = s.split('-').map(Number); return { y: yy, m: mm }; };
                    const nextYM = (y: number, m: number) => ({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1 });
                    const { y: ys, m: ms } = parseYM(ym);
                    const monthlyTotalFor = (caixaId: string, y: number, m: number) => {
                      return (transacoes as any[])
                        .filter((t: any) => t.caixaId === caixaId)
                        .filter((t: any) => { const d = new Date(t.data + 'T00:00:00'); return d.getFullYear() === y && d.getMonth() === (m - 1); })
                        .reduce((s: number, t: any) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
                    };
                    const init = (caixa as any).initialByMonth as Record<string, number> | undefined;
                    let initial = 0;
                    if (init && Object.prototype.hasOwnProperty.call(init, ym)) initial = (init as any)[ym] ?? 0; else if (init) {
                      let bestKey: string | null = null;
                      Object.keys(init).forEach(k => { const { y, m } = parseYM(k); if (ymToIndex(y, m) <= ymToIndex(ys, ms)) { if (bestKey === null) bestKey = k; else { const { y: by, m: bm } = parseYM(bestKey); if (ymToIndex(y, m) > ymToIndex(by, bm)) bestKey = k; } } });
                      if (bestKey) {
                        initial = (init as any)[bestKey] ?? 0;
                        let cy = parseYM(bestKey).y, cm = parseYM(bestKey).m;
                        while (!(cy === ys && cm === ms)) { initial += monthlyTotalFor(caixa.id, cy, cm); const n = nextYM(cy, cm); cy = n.y; cm = n.m; }
                      }
                    }
                    const saldoMes = initial + monthlyTotalFor(caixa.id, ys, ms);
                    return (
                      <SelectItem key={caixa.id} value={caixa.id}>
                        {caixa.nome} - R$ {saldoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {caixaPagamento && (() => {
                const caixa = caixas?.find((c: any) => c.id === caixaPagamento);
                // Recalcular saldo real do mês para validação
                const ym = selectedMonth; const [ys, ms] = ym.split('-').map(Number);
                const monthlyTotalFor = (caixaId: string, y: number, m: number) => (transacoes as any[])
                  .filter((t: any) => t.caixaId === caixaId)
                  .filter((t: any) => { const d = new Date(t.data + 'T00:00:00'); return d.getFullYear() === y && d.getMonth() === (m - 1); })
                  .reduce((s: number, t: any) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
                let initial = 0; const init = (caixa as any)?.initialByMonth;
                if (init && Object.prototype.hasOwnProperty.call(init, ym)) initial = init[ym] ?? 0;
                const saldoMes = caixa ? (initial + monthlyTotalFor(caixa.id, ys, ms)) : 0;
                const valorPago = parseFloat(valorPagamentoInput.replace(',', '.')) || 0;
                return caixa && valorPago > saldoMes ? (
                  <p className="text-sm text-red-600">Saldo insuficiente no caixa selecionado</p>
                ) : null;
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPagamentoOpen(false)} disabled={isSaving || isSavingRef.current}>Cancelar</Button>
            {modoPagamento === 'pay' ? (
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSavingRef.current || isSaving) return;
                  if (!isSavingRef.current && !isSaving) {
                    confirmarPagamento(e);
                  }
                }} 
                disabled={!caixaPagamento || isSaving || isSavingRef.current}
              >
                {(isSaving || isSavingRef.current) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : 'Confirmar pagamento'}
              </Button>
            ) : (
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSavingRef.current || isSaving) return;
                  if (!isSavingRef.current && !isSaving) {
                    confirmarEstorno(e);
                  }
                }} 
                disabled={!caixaPagamento || isSaving || isSavingRef.current}
              >
                {(isSaving || isSavingRef.current) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : 'Confirmar estorno'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 60); } catch {} } }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="hidden">
              <Plus className="h-4 w-4 mr-2" />
              Nova Dívida
            </Button>
          </DialogTrigger>
          <DialogContent 
            className={isMobile ? "max-h-[90vh] overflow-y-auto overscroll-contain" : ""}
            style={isMobile ? { maxHeight: '90vh', overflowY: 'scroll' } : {}}
          >
            <DialogHeader>
              <DialogTitle>
                {editingDivida ? 'Editar Dívida' : 'Nova Dívida'}
              </DialogTitle>
              <DialogDescription>
                {editingDivida 
                  ? 'Edite as informações da dívida selecionada.'
                  : 'Registre uma nova dívida para acompanhar.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Financiamento, Empréstimo, Outros."
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={(value: 'parcelada' | 'total') => setFormData(prev => ({ ...prev, tipo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parcelada">Parcelada</SelectItem>
                      <SelectItem value="total">Valor Total</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select 
                    value={formData.categoria} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="valorTotal">Valor Total</Label>
                  <Input
                    id="valorTotal"
                    type="number"
                    step="0.01"
                    value={formData.valorTotal}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      valorTotal: e.target.value,
                      valorParcela: prev.tipo === 'parcelada' ? recomputeParcela(e.target.value, prev.parcelas) : prev.valorParcela
                    }))}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              
              {formData.tipo === 'parcelada' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parcelas">Número de Parcelas</Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min="1"
                      value={formData.parcelas}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        parcelas: e.target.value,
                        valorParcela: recomputeParcela(prev.valorTotal, e.target.value)
                      }))}
                      placeholder="Ex: 12"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="valorParcela">Valor da Parcela</Label>
                    <Input
                      id="valorParcela"
                      type="number"
                      step="0.01"
                      value={formData.valorParcela}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        valorParcela: e.target.value,
                        valorTotal: prev.tipo === 'parcelada' ? recomputeTotal(e.target.value, prev.parcelas) : prev.valorTotal
                      }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="dataVencimento">Data de Vencimento</Label>
                <Input
                  id="dataVencimento"
                  type="date"
                  value={formData.dataVencimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, dataVencimento: e.target.value }))}
                  required
                />
              </div>

              {/* Checkbox para dívida em andamento */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="emAndamento"
                  checked={formData.emAndamento}
                  onChange={(e) => setFormData(prev => ({ ...prev, emAndamento: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="emAndamento" className="text-sm font-medium">
                  Esta dívida já está em andamento
                </Label>
              </div>

              {/* Campos condicionais para dívida em andamento */}
              {formData.emAndamento && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parcelaAtual">Parcela Atual</Label>
                      <Input
                        id="parcelaAtual"
                        type="number"
                        min="1"
                        max={formData.parcelas || 999}
                        value={formData.parcelaAtual}
                        onChange={(e) => setFormData(prev => ({ ...prev, parcelaAtual: e.target.value }))}
                        placeholder="Ex: 17"
                        required={formData.emAndamento}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="dataUltimoPagamento">Data do Último Pagamento</Label>
                      <Input
                        id="dataUltimoPagamento"
                        type="date"
                        value={formData.dataUltimoPagamento}
                        onChange={(e) => setFormData(prev => ({ ...prev, dataUltimoPagamento: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Resumo calculado */}
                  {formData.parcelaAtual && formData.valorParcela && (
                    <div className="p-3 dark:bg-blue-900/20 rounded-lg dark:border dark:border-blue-800">
                      <h4 className="text-sm font-medium mb-2">Resumo Calculado:</h4>
                      <div className="text-sm space-y-1">
                        <p>Parcelas pagas: {Math.max(0, parseInt(formData.parcelaAtual) - 1)}</p>
                        <p>Valor já pago: R$ {((parseInt(formData.parcelaAtual) - 1) * parseFloat(formData.valorParcela || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p>Parcelas restantes: {parseInt(formData.parcelas || '0') - Math.max(0, parseInt(formData.parcelaAtual) - 1)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                  Cancelar
                </Button>
              <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : editingDivida ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* Dialog de pagamento */}
      <Dialog open={isPagamentoOpen} onOpenChange={(o) => { 
        // Impedir fechar o modal enquanto está salvando
        if (!o && isSaving) return;
        setIsPagamentoOpen(o); 
        if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 0); } catch {} } 
      }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Registre um pagamento para: {dividaSelecionada?.descricao || compraSelecionada?.descricao}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            if (isSavingRef.current || isSaving) return;
            const valor = parseFloat(valorPagamentoInput.replace(',', '.')) || 0;
            if (valor > 0) {
              processarPagamento(valor);
            }
          }} className="space-y-4">
            {/* Informações da parcela e referência */}
            <div className="rounded border p-3 bg-muted/20 text-sm flex flex-col gap-1">
              <div>
                <span className="text-muted-foreground">Referência: </span>
                <span className="font-medium">{selectedMonth.split('-').reverse().join('/')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Valor da parcela: </span>
                <span className="font-medium">
                  {(() => {
                    if (dividaSelecionada) {
                      const valorParcelaMes = getMonthlyDue(dividaSelecionada as any);
                      return `R$ ${valorParcelaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    }
                    if (compraSelecionada) {
                      const [sy, sm] = (compraSelecionada.startMonth || selectedMonth).split('-').map(Number);
                      const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
                      const valor = purchaseInstallmentValue(compraSelecionada as any, Math.max(0, Math.min((compraSelecionada.parcelas || 1) - 1, idx)));
                      return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    }
                    return '—';
                  })()}
                </span>
              </div>
            </div>
            <div className="rounded border p-3 bg-muted/30">
              <div className="text-sm mb-1">Caixa selecionado</div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{(caixas.find((c: any) => c.id === caixaPagamento)?.nome) || '—'}</span>
                <span className="text-muted-foreground">Saldo: R$ {(() => {
                  const caixa = caixas.find((c: any) => c.id === caixaPagamento);
                  if (!caixa) return '0,00';
                  // Mesma lógica da página Caixas: initialByMonth propagado + (entradas - saídas) do mês
                  const ymToIndex = (y: number, m: number) => y * 12 + (m - 1);
                  const parseYM = (ym: string) => { const [yy, mm] = ym.split('-').map(Number); return { y: yy, m: mm }; };
                  const nextYM = (y: number, m: number) => { const nm = m === 12 ? 1 : m + 1; const ny = m === 12 ? y + 1 : y; return { y: ny, m: nm }; };
                  const monthlyTotalFor = (caixaId: string, y: number, m: number) => {
                    return (transacoes || [])
                      .filter((t: any) => t.caixaId === caixaId)
                      .filter((t: any) => { const d = new Date(t.data + 'T00:00:00'); return d.getFullYear() === y && d.getMonth() === (m - 1); })
                      .reduce((s: number, t: any) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
                  };
                  const computeInitialForMonth = (cx: any, ym: string) => {
                    const init = cx.initialByMonth as Record<string, number> | undefined;
                    if (init && Object.prototype.hasOwnProperty.call(init, ym)) return (init as any)[ym] ?? 0;
                    if (!init) return 0;
                    const { y: ty, m: tm } = parseYM(ym);
                    let bestKey: string | null = null;
                    Object.keys(init).forEach(k => { const { y, m } = parseYM(k); if (ymToIndex(y, m) <= ymToIndex(ty, tm)) { if (bestKey === null) bestKey = k; else { const { y: by, m: bm } = parseYM(bestKey); if (ymToIndex(y, m) > ymToIndex(by, bm)) bestKey = k; } } });
                    if (!bestKey) return 0;
                    const { y: sy, m: sm } = parseYM(bestKey);
                    let current = (init as any)[bestKey] ?? 0;
                    let cy = sy, cm = sm;
                    while (!(cy === ty && cm === tm)) { current = current + monthlyTotalFor(cx.id, cy, cm); const n = nextYM(cy, cm); cy = n.y; cm = n.m; }
                    return current;
                  };
                  const [yy, mm] = selectedMonth.split('-').map(Number);
                  const initial = computeInitialForMonth(caixa, selectedMonth);
                  const totalMes = monthlyTotalFor(caixa.id, yy, mm);
                  const saldoFinalMes = initial + totalMes;
                  return saldoFinalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                })()}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valorPagamento">Valor do Pagamento</Label>
              <Input
                id="valorPagamento"
                name="valorPagamento"
                type="text"
                value={valorPagamentoInput}
                onChange={(e) => setValorPagamentoInput(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataPagamento">Data do pagamento</Label>
                <Input
                  id="dataPagamento"
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horaPagamento">Hora do pagamento</Label>
                <Input
                  id="horaPagamento"
                  type="time"
                  value={horaPagamento}
                  onChange={(e) => setHoraPagamento(e.target.value)}
                />
              </div>
            </div>
            {caixas && caixas.length > 0 && (
              <div className="space-y-2">
                <Label>Selecionar Caixa</Label>
                <select className="w-full border rounded h-9 px-2 bg-background" value={caixaPagamento || ''} onChange={(e) => setCaixaPagamento(e.target.value)}>
                  {caixas.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { if (isSavingRef.current || isSaving) return; setIsPagamentoOpen(false); setDataPagamento(''); setHoraPagamento(''); }} 
                disabled={isSaving || isSavingRef.current}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || isSavingRef.current}>
                {(isSaving || isSavingRef.current) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : 'Confirmar Pagamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cabeçalho compacto */}
      <div className="flex flex-col gap-3 pb-2 border-b mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Dívidas e Cartões</h2>
              <p className="text-sm text-muted-foreground">Gerencie suas dívidas e cartões de crédito</p>
            </div>
          </div>
          
          {/* Controles - Desktop/Tablet */}
          <div className="hidden md:flex items-center gap-2">
            <Button 
              onClick={() => {
                resetForm();
                scrollBeforeDialogRef.current = window.scrollY;
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Dívida
            </Button>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              className="w-[180px]" 
            />
          </div>
        </div>
        
        {/* Controles - Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <Button 
            onClick={() => {
              resetForm();
              scrollBeforeDialogRef.current = window.scrollY;
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Dívida
          </Button>
          <Input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            className="w-[160px]" 
          />
        </div>
      </div>
      
      {/* Cards de resumo do mês selecionado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {monthlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pago no mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {monthlyPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Restante do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R$ {monthlyRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Com parcela no mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {monthlyCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              dívida(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Totais gerais (sem filtro de mês) */}
      <Card className="mt-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Totais gerais</CardTitle>
          <CardDescription>Somatório de todas as dívidas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Total das Dívidas</div>
              <div className="text-lg font-bold text-red-600">R$ {totalDividas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Pago</div>
              <div className="text-lg font-bold text-green-600">R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Restante a Pagar</div>
              <div className="text-lg font-bold text-orange-600">R$ {totalRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Vencendo em 30 dias</div>
              <div className="text-lg font-bold text-yellow-600">{dividasVencendoSoon.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cartões de Crédito dentro de Dívidas */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Cartões de Crédito</CardTitle>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-2 md:ml-auto md:flex-row md:mt-0">
              <Dialog open={isCardDialogOpen} onOpenChange={(o) => { setIsCardDialogOpen(o); if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 0); } catch {} } }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-7 px-2 text-xs"><Plus className="h-3 w-3 mr-1" /> Novo Cartão</Button>
                </DialogTrigger>
                <DialogContent 
                  className={isMobile ? "max-h-[90vh] overflow-y-auto overscroll-contain" : ""}
                  style={isMobile ? { maxHeight: '90vh', overflowY: 'scroll' } : {}}
                >
                  <DialogHeader>
                    <DialogTitle>Novo Cartão</DialogTitle>
                    <DialogDescription>
                      Adicione um novo cartão de crédito para controle de dívidas.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateCard} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={cardName} onChange={(e) => setCardName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Limite de Crédito (opcional)</Label>
                      <Input type="number" step="0.01" value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Dia de vencimento</Label>
                      <Input type="number" min="1" max="31" value={cardDueDay} onChange={(e) => setCardDueDay(e.target.value)} />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" type="button" onClick={() => setIsCardDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" disabled={isSubmittingCreateCard}>{isSubmittingCreateCard ? 'Criando...' : 'Criar'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isPurchaseDialogOpen} onOpenChange={(o) => { setIsPurchaseDialogOpen(o); if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 0); } catch {} } }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs"><Plus className="h-3 w-3 mr-1" /> Nova Compra</Button>
                </DialogTrigger>
                <DialogContent 
                  className={isMobile ? "max-h-[90vh] overflow-y-auto overscroll-contain" : ""}
                  style={isMobile ? { maxHeight: '90vh', overflowY: 'scroll' } : {}}
                >
                  <DialogHeader>
                    <DialogTitle>Nova Compra no Cartão</DialogTitle>
                    <DialogDescription>
                      Registre uma nova compra parcelada ou à vista no cartão selecionado.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreatePurchase} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cartão</Label>
                      <select className="w-full border rounded h-9 px-2 bg-background" value={selectedCardId || ''} onChange={(e) => setSelectedCardId(e.target.value)} required>
                        <option value="" disabled>Selecione</option>
                        {cartoes.map((c: CartaoCredito) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input value={purchaseDesc} onChange={(e) => setPurchaseDesc(e.target.value)} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor Total</Label>
                        <Input type="number" step="0.01" value={purchaseValorTotal} onChange={(e) => { setPurchaseValorTotal(e.target.value); setPurchaseValorParcela(recomputeParcela(e.target.value, purchaseParcelas)); }} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Parcelas</Label>
                        <Input type="number" min="1" value={purchaseParcelas} onChange={(e) => { setPurchaseParcelas(e.target.value); setPurchaseValorParcela(recomputeParcela(purchaseValorTotal, e.target.value)); }} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor da Parcela</Label>
                      <Input type="number" step="0.01" value={purchaseValorParcela} onChange={(e) => { setPurchaseValorParcela(e.target.value); setPurchaseValorTotal(recomputeTotal(e.target.value, purchaseParcelas)); }} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Começa a cobrar em (mês/ano)</Label>
                        <Input type="month" value={purchaseStartDate.slice(0,7)} onChange={(e) => setPurchaseStartDate(`${e.target.value}-01`)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Data da compra</Label>
                        <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                      </div>
                    </div>

                    {/* Checkbox para compra em andamento */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="purchaseEmAndamento"
                        checked={purchaseEmAndamento}
                        onChange={(e) => setPurchaseEmAndamento(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="purchaseEmAndamento" className="text-sm font-medium">
                        Esta compra já está em andamento
                      </Label>
                    </div>

                    {/* Campos condicionais para compra em andamento */}
                    {purchaseEmAndamento && (
                      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="purchaseParcelaAtual">Parcela Atual</Label>
                            <Input
                              id="purchaseParcelaAtual"
                              type="number"
                              min="1"
                              max={purchaseParcelas || 999}
                              value={purchaseParcelaAtual}
                              onChange={(e) => setPurchaseParcelaAtual(e.target.value)}
                              placeholder="Ex: 17"
                              required={purchaseEmAndamento}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="purchaseDataUltimoPagamento">Data do Último Pagamento</Label>
                            <Input
                              id="purchaseDataUltimoPagamento"
                              type="date"
                              value={purchaseDataUltimoPagamento}
                              onChange={(e) => setPurchaseDataUltimoPagamento(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Resumo calculado */}
                        {purchaseParcelaAtual && purchaseValorParcela && (
                          <div className="p-3 dark:bg-blue-900/20 rounded-lg dark:border dark:border-blue-800">
                            <h4 className="text-sm font-medium mb-2">Resumo Calculado:</h4>
                            <div className="text-sm space-y-1">
                              <p>Parcelas pagas: {Math.max(0, parseInt(purchaseParcelaAtual) - 1)}</p>
                              <p>Valor já pago: R$ {((parseInt(purchaseParcelaAtual) - 1) * parseFloat(purchaseValorParcela || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              <p>Parcelas restantes: {parseInt(purchaseParcelas || '0') - Math.max(0, parseInt(purchaseParcelaAtual) - 1)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" type="button" onClick={() => {
                        setIsPurchaseDialogOpen(false);
                        setPurchaseDesc(''); setPurchaseValorTotal(''); setPurchaseParcelas('1'); setPurchaseValorParcela(''); 
                        setPurchaseStartDate(`${selectedMonth}-05`); setPurchaseDate(new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'));
                        setPurchaseEmAndamento(false); setPurchaseParcelaAtual(''); setPurchaseDataUltimoPagamento('');
                      }}>Cancelar</Button>
                      <Button type="submit" disabled={isSubmittingCreatePurchase}>{isSubmittingCreatePurchase ? 'Adicionando...' : 'Adicionar'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cartoes.map((c: CartaoCredito) => {
              // Calcular total do mês baseado nas compras reais do cartão
              const comprasDoCartao = (comprasCartao as CompraCartao[]).filter(p => p.cardId === c.id);
              const totalMes = comprasDoCartao.reduce((s, compra) => {
                const [sy, sm] = compra.startMonth.split('-').map(Number);
                const [cy, cm] = selectedMonth.split('-').map(Number);
                const idx = ymToIndex(cy, cm) - ymToIndex(sy, sm);
                if (idx >= 0 && idx < compra.parcelas) {
                  return s + purchaseInstallmentValue(compra, idx);
                }
                return s;
              }, 0);
              const statusCartao = getStatusCartao(c.id);
              return (
                <div key={c.id} className="border rounded p-3">
                  <div className="flex flex-col gap-2 md:gap-1">
                    {/* Linha principal: Nome + Fatura + Status */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span className="font-medium">{c.nome}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm whitespace-nowrap">
                        <span>Fatura do mês: <span className="font-medium">R$ {totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
                        <span className={`${statusCartao.cor} font-medium`}>{statusCartao.status}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                        <button 
                          title="Pagar Fatura" 
                          onClick={() => handlePagamentoCartao(c)} 
                          className="p-2 text-green-600 hover:text-green-700"
                        >
                          <DollarSign className="h-4 w-4" />
                        </button>
                        <button title="Editar" onClick={() => openEditCard(c)} className="p-2 text-muted-foreground hover:text-foreground">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button title="Excluir" onClick={() => handleDeleteCard(c.id)} className="p-2 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Linha secundária: informações de vencimento e limite */}
                    <div className="mt-1 text-xs text-muted-foreground whitespace-normal">
                      <span>
                        Dia Vencimento:{" "}
                        <span className="text-foreground font-medium">{c.diaVencimento || "-"}</span>
                      </span>
                      {"\u00A0\u2022\u00A0"}
                      {typeof c.limite === 'number' && (() => {
                        const disp = Math.max(0, Number(c.limite) - totalMes);
                        return (
                          <>
                            <span>
                              Limite total:{" "}
                              <span className="text-foreground font-medium">
                                R$ {Number(c.limite).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </span>
                            {"\u00A0\u2022\u00A0"}
                            <span>
                              Disponível{" "}
                              <span className={`${disp > 0 ? "text-green-600" : "text-destructive"} font-medium`}>
                                R$ {disp.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <button className="text-xs text-muted-foreground mt-2 underline" onClick={() => setExpandedCardId(expandedCardId === c.id ? null : c.id)}>
                    {expandedCardId === c.id ? 'Ocultar compras' : 'Ver compras'}
                  </button>
                  {expandedCardId === c.id && (
                    <div className="mt-3 space-y-2">
                      {comprasDoCartao.length === 0 ? (
                        <div className="text-muted-foreground text-sm text-center py-4">
                          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Sem compras registradas</p>
                        </div>
                      ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 font-medium">Descrição</th>
                              <th className="text-left py-2 font-medium">Parcela</th>
                              <th className="text-left py-2 font-medium">Data de Compra</th>
                              <th className="text-left py-2 font-medium">Progresso</th>
                              <th className="text-left py-2 font-medium">Parcela do mês</th>
                              <th className="text-left py-2 font-medium">Valor Total</th>
                              <th className="text-left py-2 font-medium">Restante</th>
                              <th className="text-left py-2 font-medium">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comprasDoCartao.map((p) => {
                              const parcelasPagas = p.parcelasPagas || 0;
                              const totalParcelas = p.parcelas || 1;
                              const valorPago = parcelasPagas * p.valorParcela;
                              const valorRestante = p.valorTotal - valorPago;
                              const progresso = (valorPago / p.valorTotal) * 100;
                              
                              return (
                                <tr key={p.id} className="border-b hover:bg-muted/50">
                                  <td className="py-3 font-medium">{p.descricao}</td>
                                  <td className="py-3">
                                    <Badge variant={totalParcelas === 1 ? 'secondary' : 'default'}>
                                      {totalParcelas === 1 ? 'Valor total' : `${parcelasPagas}/${totalParcelas} parcelas`}
                                    </Badge>
                                    {totalParcelas > 1 && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        R$ {p.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cada
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3">
                                    <div className="flex items-center">
                                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                                      {new Date(p.dataCompra).toLocaleDateString('pt-BR')}
                                    </div>
                                  </td>
                                  <td className="py-3">
                                    <div className="space-y-1 w-24">
                                      <Progress value={progresso} className="h-2" />
                                      <span className="text-xs text-muted-foreground">
                                        {progresso.toFixed(1)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 font-medium">
                                    R$ {p.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 font-medium">
                                    R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3">
                                    <span className={`font-medium ${
                                      valorRestante === 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                  <td className="py-3">
                                    <div className="flex items-center gap-1">
                                      <button 
                                        title="Editar compra" 
                                        onClick={() => openEditPurchase(p)} 
                                        className="p-1 text-muted-foreground hover:text-foreground"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                      <button 
                                        title="Excluir compra" 
                                        onClick={() => handleDeletePurchase(p.id)} 
                                        className="p-1 text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      )}
                    </div>
                  )}

                  {/* Visualização em cards para mobile */}
                  <div className="md:hidden space-y-3">
                    {comprasDoCartao.map((p) => {
                      const parcelasPagas = p.parcelasPagas || 0;
                      const totalParcelas = p.parcelas || 1;
                      const valorPago = parcelasPagas * p.valorParcela;
                      const valorRestante = p.valorTotal - valorPago;
                      const progresso = (valorPago / p.valorTotal) * 100;
                      
                      return (
                        <div key={p.id} className="border rounded-lg p-4 bg-card">
                          {/* Título e valor total */}
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-bold">{p.descricao}</h3>
                            <span className="text-lg font-bold">R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          
                          {/* Parcela do mês */}
                          <div className="text-right mb-2">
                            <span className="text-sm text-red-600">Mês: R$ {p.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          
                          {/* Badge de parcelas */}
                          <div className="mb-2">
                            <Badge variant={totalParcelas === 1 ? 'secondary' : 'default'} className="text-xs">
                              {totalParcelas === 1 ? 'Valor total' : `${parcelasPagas}/${totalParcelas} parcelas`}
                            </Badge>
                          </div>
                          
                          {/* Data de compra */}
                          <div className="flex items-center mb-3 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(p.dataCompra).toLocaleDateString('pt-BR')}
                          </div>
                          
                          {/* Progresso e restante */}
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm">{progresso.toFixed(1)}% pago</span>
                            <span className={`text-sm font-medium ${valorRestante === 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Falta: R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          
                          {/* Barra de progresso */}
                          <div className="mb-4">
                            <Progress value={progresso} className="h-2" />
                          </div>
                          
                          {/* Ações */}
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1">
                              <button 
                                title="Editar compra" 
                                onClick={() => openEditPurchase(p)} 
                                className="p-2 text-muted-foreground hover:text-foreground"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                title="Excluir compra" 
                                onClick={() => handleDeletePurchase(p.id)} 
                                className="p-2 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Editar Cartão */}
      <Dialog open={isEditCardDialogOpen} onOpenChange={setIsEditCardDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>Editar Cartão</DialogTitle>
            <DialogDescription>
              Edite as informações do cartão de crédito selecionado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEditCard} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Limite de Crédito (opcional)</Label>
              <Input type="number" step="0.01" value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dia de vencimento</Label>
              <Input type="number" min="1" max="31" value={cardDueDay} onChange={(e) => setCardDueDay(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditCardDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar Compra */}
      <Dialog open={isEditPurchaseDialogOpen} onOpenChange={setIsEditPurchaseDialogOpen}>
        <DialogContent className={isMobile ? "max-h-[90vh] overflow-y-auto overscroll-contain" : ""}>
          <DialogHeader>
            <DialogTitle>Editar Compra</DialogTitle>
            <DialogDescription>
              Edite as informações da compra selecionada.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEditPurchase} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={purchaseDesc} onChange={(e) => setPurchaseDesc(e.target.value)} required />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total</Label>
                <Input 
                  type="text" 
                  value={purchaseValorTotal} 
                  onChange={(e) => {
                    setPurchaseValorTotal(e.target.value);
                    const novaParcela = recomputeParcela(e.target.value, purchaseParcelas);
                    if (novaParcela) setPurchaseValorParcela(novaParcela);
                  }} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={purchaseParcelas} 
                  onChange={(e) => {
                    setPurchaseParcelas(e.target.value);
                    const novaParcela = recomputeParcela(purchaseValorTotal, e.target.value);
                    if (novaParcela) setPurchaseValorParcela(novaParcela);
                  }} 
                  required 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Valor da Parcela</Label>
              <Input 
                type="text" 
                value={purchaseValorParcela} 
                onChange={(e) => {
                  setPurchaseValorParcela(e.target.value);
                  const novoTotal = recomputeTotal(e.target.value, purchaseParcelas);
                  if (novoTotal) setPurchaseValorTotal(novoTotal);
                }} 
                required 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data da Compra</Label>
                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Primeira Competência</Label>
                <Input type="date" value={purchaseStartDate} onChange={(e) => setPurchaseStartDate(e.target.value)} required />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="purchaseEmAndamento" 
                  checked={purchaseEmAndamento} 
                  onChange={(e) => setPurchaseEmAndamento(e.target.checked)} 
                  className="rounded"
                />
                <Label htmlFor="purchaseEmAndamento">Compra já em andamento</Label>
              </div>
            </div>
            
            {purchaseEmAndamento && (
              <div className="space-y-2">
                <Label>Parcela Atual</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max={purchaseParcelas} 
                  value={purchaseParcelaAtual} 
                  onChange={(e) => setPurchaseParcelaAtual(e.target.value)} 
                />
              </div>
            )}
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditPurchaseDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Progresso geral */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso Geral</CardTitle>
          <CardDescription>Percentual pago do total das dívidas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(() => {
              // Calcular progresso geral baseado em totais: (Total Pago) / (Total das Dívidas)
              // Total Pago = Total das Dívidas - Total Restante
              const totalPagoCalculado = totalDividas - totalRestante;
              const percentualGeral = totalDividas > 0 && isFinite(totalDividas) && isFinite(totalPagoCalculado) 
                ? (totalPagoCalculado / totalDividas) * 100 
                : 0;
              return (
                <>
                  <Progress value={Math.max(0, Math.min(100, percentualGeral))} />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>R$ {isFinite(totalPagoCalculado) ? totalPagoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'} pago</span>
                    <span>{isFinite(percentualGeral) ? percentualGeral.toFixed(1) : '0,0'}%</span>
                  </div>
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Lista de dívidas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Dívidas</CardTitle>
          <CardDescription>
            {listDividasForMonth.length} dívida(s) com vencimento em {selectedMonth.split('-').reverse().join('/')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Versão mobile - Lista de cards */}
          <div className="md:hidden space-y-3">
            {listDividasForMonth.map((divida) => {
              const percentualPago = getPercentualProgresso(divida);
              const restante = getValorRestante(divida);
              // Para dívidas distribuídas, só considerar quitada se TODAS as parcelas estão pagas (progresso = 100%)
              // Para outras dívidas, usar lógica normal
              const isQuitada = divida.parcelaIndex !== undefined && divida.parcelaTotal !== undefined
                ? percentualPago >= 100
                : divida.valorPago >= divida.valorTotal;
              const parcelaMes = getMonthlyDue(divida);
              const { status, cor, bg } = getStatusParcela(divida);
              
              return (
                <div key={divida.id} className={`border rounded-lg p-3 space-y-3 ${isQuitada ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <p className="font-medium">{divida.descricao}</p>
                      <Badge variant={divida.tipo === 'parcelada' ? 'default' : 'secondary'} className="text-xs">
                        {divida.tipo === 'parcelada' 
                          ? (() => {
                              const parcelaDoMes = getParcelaDoMes(divida);
                              return parcelaDoMes ? `${parcelaDoMes}/${divida.parcelas} parcelas` : `Sem parcela este mês`;
                            })()
                          : 'Valor total'
                        }
                      </Badge>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(((divida as any).dataVencimentoExibida ?? divida.dataVencimento) + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium">
                        R$ {divida.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {parcelaMes > 0 && (
                        <div className={`text-xs ${bg} ${cor} px-2 py-1 rounded`}>
                          Mês: R$ {parcelaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                        <span>{percentualPago.toFixed(1)}% pago</span>
                        <span className={restante > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                          Falta: R$ {restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      </div>
                      <Progress value={percentualPago} className="h-2" />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePagamento(divida)}
                          className="text-green-600 hover:text-green-700"
                          title="Registrar Pagamento"
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                        <span className={`text-sm ${cor}`}>
                          {status}
                        </span>
                      </div>
                      
                      <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(divida)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(divida.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Versão desktop - Tabela */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead className="text-right">Parcela do mês</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Restante</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listDividasForMonth.map((divida) => {
                  const percentualPago = getPercentualProgresso(divida);
                  const restante = getValorRestante(divida);
                  // Para dívidas distribuídas, só considerar quitada se TODAS as parcelas estão pagas (progresso = 100%)
                  // Para outras dívidas, usar lógica normal
                  const isQuitada = divida.parcelaIndex !== undefined && divida.parcelaTotal !== undefined
                    ? percentualPago >= 100
                    : divida.valorPago >= divida.valorTotal;
                  const parcelaMes = getMonthlyDue(divida);
                  
                  return (
                    <TableRow key={divida.id} className={isQuitada ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {parcelaMes > 0 && (() => {
                            // Para dívidas parceladas: usar valorPago vs valorParcela (não transações)
                            const valorPago = divida.valorPago || 0;
                            const valorParcela = divida.valorParcela || (divida.valorTotal / (divida.parcelas || 1));
                            const estaPaga = valorPago >= valorParcela;
                            return (
                              <div className={estaPaga ? 'text-green-600' : 'text-red-600'}>
                                {estaPaga ? (
                                  <CheckCircle className="h-5 w-5" />
                                ) : (
                                  <Circle className="h-5 w-5" />
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {divida.descricao}
                      </TableCell>
                      <TableCell>
                        <Badge variant={divida.tipo === 'parcelada' ? 'default' : 'secondary'}>
                          {divida.tipo === 'parcelada' 
                            ? (() => {
                                const parcelaDoMes = getParcelaDoMes(divida);
                                return parcelaDoMes ? `${parcelaDoMes}/${divida.parcelas} parcelas` : `Sem parcela este mês`;
                              })()
                            : 'Valor total'
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                          {new Date(((divida as any).dataVencimentoExibida ?? divida.dataVencimento) + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={percentualPago} className="h-2" />
                          <span className="text-xs text-muted-foreground">
                            {percentualPago.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {parcelaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {divida.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={restante > 0 ? 'text-red-600' : 'text-green-600'}>
                          R$ {restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePagamento(divida)}
                              className="text-green-600 hover:text-green-700"
                            title="Registrar Pagamento"
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(divida)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(divida.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {dividas.length === 0 && (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma dívida cadastrada</h3>
              <p className="text-muted-foreground mb-4">
                Comece registrando suas dívidas para melhor controle financeiro.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar primeira dívida
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
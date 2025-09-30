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
import { Trash2, Plus, Edit, Calendar, CheckCircle, CreditCard } from 'lucide-react';
import { FinanceiroContext, Divida, GastoFixo, CartaoCredito, CompraCartao } from '../App';

export default function DividasManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { dividas, setDividas, saveDivida, deleteDivida, caixas, saveCaixa, transacoes, saveTransacao, deleteTransacao, gastosFixos, setGastosFixos, saveGastoFixo, deleteGastoFixo, cartoes = [], setCartoes, comprasCartao = [], setComprasCartao, saveCartao, saveCompraCartao, categorias = [] } = context as any;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const scrollBeforeDialogRef = useRef<number>(0);
  const [editingDivida, setEditingDivida] = useState<Divida | null>(null);
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);
  const [dividaSelecionada, setDividaSelecionada] = useState<Divida | null>(null);
  const [compraSelecionada, setCompraSelecionada] = useState<CompraCartao | null>(null);
  const [caixaPagamento, setCaixaPagamento] = useState<string | null>(null);
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
  const [cardName, setCardName] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardDueDay, setCardDueDay] = useState('15');
  const [editingCard, setEditingCard] = useState<CartaoCredito | null>(null);
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

  const replanGastosFixosDaDivida = async (d: Divida) => {
    const dataCorrigida = new Date(d.dataVencimento + 'T00:00:00');
    const sy = dataCorrigida.getFullYear();
    const sm = dataCorrigida.getMonth() + 1;
    const sd = dataCorrigida.getDate();
    const expected = new Set<string>();
    const totalParcelas = d.tipo === 'parcelada' ? d.parcelas : 1;
    for (let i = 0; i < totalParcelas; i++) {
      const { y, m } = addMonths(sy, sm, i);
      const ym = `${y}-${String(m).padStart(2,'0')}`;
      expected.add(ym);
      const gastoId = `divida:${d.id}:${ym}`;
      const valor = getInstallmentValue(d, i);
      const gasto: GastoFixo = { id: gastoId, descricao: d.descricao, valor, categoria: (d as any).categoria || 'Esporádicos', diaVencimento: sd, dataVencimento: `${y}-${String(m).padStart(2, '0')}-${String(sd).padStart(2, '0')}`, pago: i < (d.parcelasPagas || 0) } as any;
      await saveGastoFixo(gasto);
      setGastosFixos((prev: GastoFixo[]) => {
        const j = prev.findIndex(g => g.id === gastoId);
        if (j >= 0) { const clone = [...prev]; clone[j] = gasto; return clone; }
        return [...prev, gasto];
      });
    }
    // Remover gastos que sobraram
    const toRemove = (gastosFixos as GastoFixo[]).filter(g => g.id.startsWith(`divida:${d.id}:`)).filter(g => !expected.has(g.id.split(':')[2]));
    for (const g of toRemove) {
      await deleteGastoFixo(g.id);
      setGastosFixos((prev: GastoFixo[]) => prev.filter(x => x.id !== g.id));
    }
  };

  const replanGastosFixosDaCompra = async (compra: CompraCartao) => {
    console.log('🔍 DEBUG - replanGastosFixosDaCompra chamada com:', compra);
    
    const [sy, sm] = compra.startMonth.split('-').map(Number);
    const card = (cartoes as CartaoCredito[]).find(x => x.id === compra.cardId);
    const day = card?.diaVencimento || compra.startDay || 5;
    console.log('🔍 DEBUG - Parâmetros calculados:', { sy, sm, day, cardName: card?.nome });
    
    const expected = new Set<string>();
    const totalParcelas = compra.parcelas;
    
    // Primeiro, remover TODOS os gastos antigos desta compra
    const prefix = `cartao:${compra.cardId}:${compra.id}:`;
    const gastosAntigos = (gastosFixos as GastoFixo[]).filter(g => g.id.startsWith(prefix));
    console.log('🔍 DEBUG - Removendo TODOS os gastos antigos:', gastosAntigos);
    
    for (const g of gastosAntigos) {
      console.log('🔍 DEBUG - Removendo gasto antigo:', g.id);
      await deleteGastoFixo(g.id);
      setGastosFixos((prev: GastoFixo[]) => prev.filter(x => x.id !== g.id));
    }
    
    // Agora criar os novos gastos
    for (let i = 0; i < totalParcelas; i++) {
      const { y, m } = addMonths(sy, sm, i);
      const ym = `${y}-${String(m).padStart(2,'0')}`;
      expected.add(ym);
      const valor = getInstallmentValue({
        id: 'tmp', descricao: '', valorTotal: compra.valorTotal, valorPago: 0, parcelas: compra.parcelas, parcelasPagas: compra.parcelasPagas || 0, valorParcela: compra.valorParcela, dataVencimento: `${compra.startMonth}-${String(day).padStart(2,'0')}`, tipo: compra.parcelas > 1 ? 'parcelada' : 'total'
      } as Divida, i);
      const gastoId = `cartao:${compra.cardId}:${compra.id}:${ym}`;
      const cardName = (cartoes as CartaoCredito[]).find(c => c.id === compra.cardId)?.nome || '';
      const gasto: GastoFixo = { id: gastoId, descricao: `Cartão ${cardName}: ${compra.descricao} – ${i+1}/${compra.parcelas}`, valor, categoria: 'Cartão de Crédito', diaVencimento: day, pago: i < (compra.parcelasPagas || 0) } as any;
      
      console.log(`🔍 DEBUG - Criando gasto fixo ${i+1}/${compra.parcelas}:`, gasto);
      
      await saveGastoFixo(gasto);
      setGastosFixos((prev: GastoFixo[]) => {
        const j = prev.findIndex(g => g.id === gastoId);
        if (j >= 0) { const clone = [...prev]; clone[j] = gasto; return clone; }
        return [...prev, gasto];
      });
    }
    
    console.log('✅ DEBUG - replanGastosFixosDaCompra concluída');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descricao || !formData.valorTotal || !formData.dataVencimento) return;

    // Ajusta parcela automaticamente se for parcelada e não informada
    let valorParcelaNum = formData.tipo === 'parcelada'
      ? (formData.valorParcela ? parseFloat(formData.valorParcela) : parseFloat(recomputeParcela(formData.valorTotal, formData.parcelas) || '0'))
      : parseFloat(formData.valorTotal);

    // Se for uma compra de cartão (id começa com purchase:), atualiza a compra em vez da dívida
    if (editingDivida?.id && editingDivida.id.startsWith('purchase:')) {
      console.log('🔍 DEBUG - handleSubmit: Editando compra de cartão');
      const purchaseId = editingDivida.id.replace('purchase:', '');
      console.log('🔍 DEBUG - Purchase ID extraído:', purchaseId);
      
      const compraAtual = (comprasCartao as CompraCartao[]).find(p => p.id === purchaseId);
      console.log('🔍 DEBUG - Compra atual encontrada:', compraAtual);
      
      if (!compraAtual) {
        console.log('❌ DEBUG - Compra atual NÃO encontrada!');
        return;
      }
      
      const cardForPurchase = (cartoes as CartaoCredito[]).find(c => c.id === compraAtual.cardId);
      console.log('🔍 DEBUG - Cartão da compra:', cardForPurchase);
      
      // Calcular parcelas pagas se for dívida em andamento
      const parcelasPagas = formData.emAndamento ? Math.max(0, parseInt(formData.parcelaAtual) - 1) : (compraAtual.parcelasPagas || 0);
      console.log('🔍 DEBUG - Parcelas pagas calculadas:', { 
        emAndamento: formData.emAndamento, 
        parcelaAtual: formData.parcelaAtual, 
        parcelasPagas 
      });
      
      const updated: CompraCartao = {
        ...compraAtual,
        descricao: formData.descricao,
        valorTotal: parseFloat(formData.valorTotal),
        parcelas: formData.tipo === 'parcelada' ? parseInt(formData.parcelas) : 1,
        valorParcela: formData.tipo === 'parcelada' ? valorParcelaNum : parseFloat(formData.valorTotal),
        startMonth: new Date(formData.dataVencimento + 'T00:00:00').toISOString().slice(0,7),
        startDay: (cardForPurchase?.diaVencimento || compraAtual.startDay || 5),
        parcelasPagas: parcelasPagas, // ← ADICIONADO
      } as CompraCartao;
      
      console.log('🔍 DEBUG - Compra atualizada que será salva:', updated);
      
      await saveCompraCartao(updated);
      console.log('✅ DEBUG - Compra salva no Firebase');
      
      setComprasCartao((prev: CompraCartao[]) => prev.map(p => p.id === updated.id ? updated : p));
      console.log('✅ DEBUG - Estado local atualizado');
      
      try { 
        console.log('🔍 DEBUG - Chamando replanGastosFixosDaCompra...');
        await replanGastosFixosDaCompra(updated); 
        console.log('✅ DEBUG - replanGastosFixosDaCompra concluído');
      } catch (error) {
        console.log('❌ DEBUG - Erro em replanGastosFixosDaCompra:', error);
      }
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

      await saveDivida(novaDivida);
      setDividas(prev => {
        const index = prev.findIndex(d => d.id === novaDivida.id);
        if (index >= 0) {
          const clone = [...prev];
          clone[index] = novaDivida;
          return clone;
        }
        return [...prev, novaDivida];
      });

      try { await replanGastosFixosDaDivida(novaDivida); } catch {}
    }

    resetForm();
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
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) return;
    const novo: CartaoCredito = { id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(), nome: cardName.trim(), limite: cardLimit ? parseFloat(cardLimit) : undefined, diaVencimento: parseInt(cardDueDay || '15') } as any;
    await saveCartao(novo);
    setCardName('');
    setIsCardDialogOpen(false);
    setCardName(''); setCardLimit(''); setCardDueDay('15');
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
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
      startDay,
    } as any;
    await saveCompraCartao(p);

    // gerar gastos fixos vinculados com dia do vencimento do cartão
    try {
      const [sy, sm] = startMonth.split('-').map(Number);
      for (let i = 0; i < p.parcelas; i++) {
        const { y, m } = addMonths(sy, sm, i);
        const ym = `${y}-${String(m).padStart(2,'0')}`;
        const valor = getInstallmentValue({
          id: 'tmp', descricao: '', valorTotal: p.valorTotal, valorPago: 0, parcelas: p.parcelas, parcelasPagas: 0, valorParcela: p.valorParcela, dataVencimento: `${startMonth}-${String(startDay).padStart(2,'0')}`, tipo: p.parcelas > 1 ? 'parcelada' : 'total'
        } as Divida, i);
        const gastoId = `cartao:${p.cardId}:${p.id}:${ym}`;
        const gasto: GastoFixo = { id: gastoId, descricao: `Cartão ${(cartoes as CartaoCredito[]).find(c => c.id === p.cardId)?.nome || ''}: ${p.descricao} – ${i+1}/${p.parcelas}`, valor, categoria: 'Cartão de Crédito', diaVencimento: startDay, pago: i < parcelasPagas } as any;
        await saveGastoFixo(gasto);
        setGastosFixos((prev: GastoFixo[]) => {
          const j = prev.findIndex(g => g.id === gastoId);
          if (j >= 0) { const clone = [...prev]; clone[j] = gasto; return clone; }
          return [...prev, gasto];
        });
      }
    } catch {}

    setIsPurchaseDialogOpen(false);
    setPurchaseDesc(''); setPurchaseValorTotal(''); setPurchaseParcelas('1'); setPurchaseValorParcela(''); setPurchaseStartDate(`${selectedMonth}-05`);
    setPurchaseEmAndamento(false); setPurchaseParcelaAtual(''); setPurchaseDataUltimoPagamento('');
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Excluir este cartão e suas compras?')) return;
    try {
      // Estornar transações de todas as compras deste cartão
      const compras = (comprasCartao as CompraCartao[]).filter(p => p.cardId === cardId);
      for (const c of compras) {
        await estornarTransacoesDaCompra(c.descricao);
      }

      // remover gastos fixos vinculados
      const prefix = `cartao:${cardId}:`;
      const vinculados = (gastosFixos as GastoFixo[]).filter(g => g.id.startsWith(prefix));
      for (const g of vinculados) {
        await deleteGastoFixo(g.id);
      }

      // remover compras deste cartão
      for (const c of compras) {
        await (context as any).deleteCompraCartao(c.id);
      }

      // remover cartão
      await (context as any).deleteCartao(cardId);
    } catch (e) {
      console.error(e);
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

  const handleSaveEditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    const atualizado: CartaoCredito = { ...editingCard, nome: cardName.trim() || editingCard.nome, limite: cardLimit ? parseFloat(cardLimit) : undefined, diaVencimento: parseInt(cardDueDay || '15') } as any;
    try {
      await saveCartao(atualizado);
      setCartoes((prev: CartaoCredito[]) => prev.map(c => c.id === atualizado.id ? atualizado : c));
      setIsEditCardDialogOpen(false);
      setEditingCard(null);
      setCardName(''); setCardLimit('');
    } catch (e) {
      console.error(e);
      alert('Não foi possível salvar o cartão.');
    }
  };

  const handleEdit = (divida: Divida) => {
    console.log('🔍 DEBUG - handleEdit chamado com:', {
      dividaId: divida.id,
      dividaDescricao: divida.descricao,
      isPurchase: divida.id.startsWith('purchase:'),
      dividaCompleta: divida
    });

    try { scrollBeforeDialogRef.current = window.scrollY || 0; } catch {}
    setEditingDivida(divida);
    
    // Se for compra de cartão, buscar dados originais
    if (divida.id.startsWith('purchase:')) {
      const purchaseId = divida.id.replace('purchase:', '');
      console.log('🔍 DEBUG - Buscando compra original com ID:', purchaseId);
      
      const compraOriginal = (comprasCartao as CompraCartao[]).find(p => p.id === purchaseId);
      console.log('🔍 DEBUG - Compra original encontrada:', compraOriginal);
      
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
        
        console.log('🔍 DEBUG - FormData que será definido (compra original):', formDataToSet);
        setFormData(formDataToSet);
      } else {
        console.log('⚠️ DEBUG - Compra original NÃO encontrada, usando dados da dívida mapeada');
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
      console.log('🔍 DEBUG - Dívida manual normal, usando dados da dívida');
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

  // Função para estornar transações relacionadas a uma dívida
  const estornarTransacoesDaDivida = async (dividaId: string) => {
    try {
      // Buscar transações relacionadas a esta dívida
      const transacoesRelacionadas = (transacoes as any[]).filter(t => 
        t.descricao.includes(`Pagamento dívida:`) && 
        t.descricao.includes(dividaId)
      );
      
      // Estornar cada transação encontrada
      for (const transacao of transacoesRelacionadas) {
        // Atualizar saldo do caixa (adicionar de volta o valor)
        const caixa = (caixas as any[]).find(c => c.id === transacao.caixaId);
        if (caixa) {
          const novoSaldo = caixa.saldo + transacao.valor;
          await (saveCaixa && (saveCaixa as any)({ ...caixa, saldo: novoSaldo }));
        }
        
        // Excluir a transação
        await (deleteTransacao && deleteTransacao(transacao.id));
      }
    } catch (error) {
      console.error('Erro ao estornar transações:', error);
    }
  };

  // Função para estornar transações relacionadas a uma compra de cartão
  const estornarTransacoesDaCompra = async (compraId: string) => {
    try {
      // Buscar transações relacionadas a esta compra
      const transacoesRelacionadas = (transacoes as any[]).filter(t => 
        t.descricao.includes(`Pagamento cartão:`) && 
        t.descricao.includes(compraId)
      );
      
      // Estornar cada transação encontrada
      for (const transacao of transacoesRelacionadas) {
        // Atualizar saldo do caixa (adicionar de volta o valor)
        const caixa = (caixas as any[]).find(c => c.id === transacao.caixaId);
        if (caixa) {
          const novoSaldo = caixa.saldo + transacao.valor;
          await (saveCaixa && (saveCaixa as any)({ ...caixa, saldo: novoSaldo }));
        }
        
        // Excluir a transação
        await (deleteTransacao && deleteTransacao(transacao.id));
      }
    } catch (error) {
      console.error('Erro ao estornar transações da compra:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    // Caso seja uma compra de cartão mapeada como dívida
    if (id.startsWith('purchase:')) {
      const purchaseId = id.replace('purchase:', '');
      const compra = (comprasCartao as CompraCartao[]).find(p => p.id === purchaseId);
      if (!compra) return;
      try {
        // Estornar transações relacionadas primeiro
        await estornarTransacoesDaCompra(compra.descricao);
        
        await (context as any).deleteCompraCartao(purchaseId);
        setComprasCartao((prev: CompraCartao[]) => prev.filter(p => p.id !== purchaseId));
        
        // remover gastos fixos vinculados
        const prefix = `cartao:${compra.cardId}:${compra.id}:`;
        const vinculados = (gastosFixos as GastoFixo[]).filter(g => g.id.startsWith(prefix));
        
        for (const g of vinculados) {
          await deleteGastoFixo(g.id);
        }
      } catch (e) {
        console.error(e);
        alert('Não foi possível excluir a compra do cartão.');
      }
      return;
    }

    // Dívida normal
    try {
      // Estornar transações relacionadas primeiro
      await estornarTransacoesDaDivida(id);
      
      await deleteDivida(id);
      setDividas(prev => prev.filter(d => d.id !== id));
      
      const prefix = `divida:${id}:`;
      const vinculados = (gastosFixos as GastoFixo[]).filter(g => g.id.startsWith(prefix));
      for (const g of vinculados) {
        await deleteGastoFixo(g.id);
      }
    } catch (e) {
      console.error('Erro ao excluir dívida:', e);
      alert('Não foi possível excluir a dívida.');
    }
  };

  const handlePagamento = (divida: Divida) => {
    setDividaSelecionada(divida);
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setIsPagamentoOpen(true);
  };

  const handlePagamentoCompra = (compra: CompraCartao) => {
    setCompraSelecionada(compra);
    setDividaSelecionada(null);
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setIsPagamentoOpen(true);
  };

  const processarPagamento = async (valorPagamento: number) => {
    if (!dividaSelecionada && !compraSelecionada) return;
    if (!caixaPagamento) { alert('Selecione um caixa.'); return; }
    // Bloqueio de saldo negativo
    const c = (caixas || []).find((x: any) => x.id === caixaPagamento);
    if (c && c.saldo < valorPagamento) { alert('Saldo insuficiente no caixa selecionado.'); return; }

    if (dividaSelecionada) {
      const dividaAtual = dividas.find(d => d.id === dividaSelecionada.id);
      if (!dividaAtual) return;

      const novoValorPago = dividaAtual.valorPago + valorPagamento;
      const novasParcelasPagas = dividaAtual.tipo === 'parcelada' 
        ? Math.floor(novoValorPago / dividaAtual.valorParcela)
        : novoValorPago >= dividaAtual.valorTotal ? 1 : 0;

      const atualizada: Divida = {
        ...dividaAtual,
          valorPago: novoValorPago,
        parcelasPagas: Math.min(novasParcelasPagas, dividaAtual.parcelas),
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
          data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
          hora: new Date().toTimeString().slice(0,5)
        }));
      } catch {}

      // marcar gasto fixo do mês como pago, se existir
      try {
        const ym = `${selectedYM.y}-${String(selectedYM.m).padStart(2,'0')}`;
        const gastoId = `divida:${dividaAtual.id}:${ym}`;
        const existente = (gastosFixos as GastoFixo[]).find(g => g.id === gastoId);
        if (existente) {
          const atualizadoGasto: GastoFixo = { ...existente, pago: true } as any;
          await (saveGastoFixo && saveGastoFixo(atualizadoGasto));
          setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === gastoId ? atualizadoGasto : g));
        }
      } catch {}
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
          data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'),
          hora: new Date().toTimeString().slice(0,5)
        }));
      } catch {}

      try {
        const ym = `${selectedYM.y}-${String(selectedYM.m).padStart(2,'0')}`;
        const gastoId = `cartao:${compra.cardId}:${compra.id}:${ym}`;
        const existente = (gastosFixos as GastoFixo[]).find(g => g.id === gastoId);
        if (existente) {
          const atualizadoGasto: GastoFixo = { ...existente, pago: true } as any;
          await (saveGastoFixo && saveGastoFixo(atualizadoGasto));
          setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === gastoId ? atualizadoGasto : g));
        }
      } catch {}
    }

    setIsPagamentoOpen(false);
    setDividaSelecionada(null);
    setCompraSelecionada(null);
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

  // Datas sem deslocamento de fuso: tratar 'YYYY-MM-DD' como data local
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
    // Valor total: conta no mês do vencimento
    const vencYM = parseYYYYMMDDtoYM(d.dataVencimento);
    if (vencYM.y === selectedYM.y && vencYM.m === selectedYM.m) {
      return d.valorTotal;
    }
    return 0;
  };

  const getMonthlyPaid = (d: Divida): number => {
    if (d.tipo === 'parcelada') {
      const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
      const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
      if (idx < 0 || idx >= d.parcelas) return 0;
      const delta = Math.round(d.valorTotal * 100) - Math.round(d.valorParcela * 100) * d.parcelas;
      const isLast = idx === d.parcelas - 1;
      const parcelaEsperada = d.valorParcela + (isLast ? delta / 100 : 0);
      // Considera paga se a competência já está dentro das parcelasPagas
      return idx < d.parcelasPagas ? parcelaEsperada : 0;
    }
    const vencYM = parseYYYYMMDDtoYM(d.dataVencimento);
    if (vencYM.y === selectedYM.y && vencYM.m === selectedYM.m) {
      return d.valorPago >= d.valorTotal ? d.valorTotal : 0;
    }
    return 0;
  };

  // Totais mensais
  const monthlyTotal = dividas.reduce((sum, d) => sum + getMonthlyDue(d), 0);
  const monthlyPaid = dividas.reduce((sum, d) => sum + getMonthlyPaid(d), 0);
  const monthlyRemaining = Math.max(0, monthlyTotal - monthlyPaid);
  const monthlyCount = dividas.filter(d => getMonthlyDue(d) > 0).length;

  // Mapear compras de cartão como "dividas" para exibição com datas ajustadas
  const [anoSelecionado, mesSelecionado] = selectedMonth.split('-').map(Number);
  const purchasesAsDividas: Divida[] = (comprasCartao as CompraCartao[]).map((c) => {
    const card = (cartoes as CartaoCredito[]).find(x => x.id === c.cardId);
    const dueDay = (card?.diaVencimento ?? c.startDay ?? 5);
    
    // Verificar se a parcela do mês atual foi paga nos gastos fixos
    const parcelaDoMesId = `cartao:${c.cardId}:${c.id}:${selectedMonth}`;
    const parcelaDoMesPaga = (gastosFixos as any[]).find(g => g.id === parcelaDoMesId)?.pago || false;
    
    // Calcular parcelas pagas baseado nos gastos fixos
    const parcelasPagasNosGastosFixos = (gastosFixos as any[]).filter(g => 
      g.id.startsWith(`cartao:${c.cardId}:${c.id}:`) && g.pago
    ).length;
    
    const parcelasPagasAtualizadas = Math.max(c.parcelasPagas || 0, parcelasPagasNosGastosFixos);
    const valorPagoEstimado = Math.min(c.parcelas, parcelasPagasAtualizadas) * c.valorParcela + (parcelasPagasAtualizadas === c.parcelas ? (Math.round(c.valorTotal * 100) - Math.round(c.valorParcela * 100) * c.parcelas) / 100 : 0);
    
    // Ajustar data de vencimento para o mês selecionado
    const dataVencimentoAjustada = `${anoSelecionado}-${String(mesSelecionado).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`;
    
    return {
      id: `purchase:${c.id}`,
      descricao: `Cartão ${(cartoes as CartaoCredito[]).find(x => x.id === c.cardId)?.nome || ''}: ${c.descricao}`,
      valorTotal: c.valorTotal,
      valorPago: valorPagoEstimado,
      parcelas: c.parcelas,
      parcelasPagas: parcelasPagasAtualizadas,
      valorParcela: c.valorParcela,
      dataVencimento: dataVencimentoAjustada,
      tipo: c.parcelas > 1 ? 'parcelada' : 'total',
    } as Divida;
  });
  // Ajustar datas das dívidas normais para o mês selecionado
  const dividasComDataAjustada = dividas.map(divida => {
    // Validar se dataVencimento existe e é válida
    if (!divida.dataVencimento) {
      return divida;
    }
    
    const dataOriginal = new Date(divida.dataVencimento + 'T00:00:00');
    const diaVencimento = dataOriginal.getDate();
    
    // Validar se a data é válida
    if (isNaN(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
      return divida;
    }
    
    // Criar nova data com o dia original mas mês/ano selecionado
    const novaData = new Date(anoSelecionado, mesSelecionado - 1, diaVencimento);
    
    // Validar se a nova data é válida
    if (isNaN(novaData.getTime())) {
      return divida;
    }
    
    const dataVencimentoAjustada = novaData.toISOString().split('T')[0];
    
    return {
      ...divida,
      dataVencimento: dataVencimentoAjustada
    };
  });

  // Unificar e deduplicar por id (evita warnings de keys duplicadas)
  const allDividasForView: Divida[] = (() => {
    const map = new Map<string, Divida>();
    [...dividasComDataAjustada, ...purchasesAsDividas].forEach((d) => {
      if (!map.has(d.id)) map.set(d.id, d);
    });
    return Array.from(map.values());
  })();

  // Mostrar na lista apenas o que tem parcela no mês selecionado
  const listDividasForMonth: Divida[] = allDividasForView.filter(d => getMonthlyDue(d) > 0);

  // Helpers para fatura do cartão
  const purchaseInstallmentValue = (p: CompraCartao, idx: number): number => {
    const delta = Math.round(p.valorTotal * 100) - Math.round(p.valorParcela * 100) * p.parcelas;
    const isLast = idx === p.parcelas - 1;
    return p.valorParcela + (isLast ? delta / 100 : 0);
  };
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



  // Calcular totais
  const totalDividas = dividas.reduce((sum, d) => sum + d.valorTotal, 0);
  const totalPago = dividas.reduce((sum, d) => sum + d.valorPago, 0);
  const totalRestante = totalDividas - totalPago;

  // Dívidas próximas do vencimento (próximos 30 dias)
  const hoje = new Date();
  const proximoMes = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const dividasVencendoSoon = dividas.filter(divida => {
    const vencimento = localDateFromYYYYMMDD(divida.dataVencimento);
    return vencimento >= hoje && vencimento <= proximoMes && divida.valorPago < divida.valorTotal;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Dívidas</h2>
          <p className="text-muted-foreground">
            Controle suas dívidas totais e parceladas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 60); } catch {} } }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Dívida
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                      onChange={(e) => setFormData(prev => ({ ...prev, valorParcela: e.target.value }))}
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
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingDivida ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog de pagamento */}
      <Dialog open={isPagamentoOpen} onOpenChange={(o) => { setIsPagamentoOpen(o); if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 0); } catch {} } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Registre um pagamento para: {dividaSelecionada?.descricao}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const valor = parseFloat(formData.get('valorPagamento') as string);
            if (valor > 0) {
              processarPagamento(valor);
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valorPagamento">Valor do Pagamento</Label>
              <Input
                id="valorPagamento"
                name="valorPagamento"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
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
              <Button type="button" variant="outline" onClick={() => setIsPagamentoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cards de resumo do mês selecionado */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">Mês</div>
        <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-[180px]" />
      </div>
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
                <DialogContent>
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
                      <Button type="submit">Criar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isPurchaseDialogOpen} onOpenChange={(o) => { setIsPurchaseDialogOpen(o); if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 0); } catch {} } }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs"><Plus className="h-3 w-3 mr-1" /> Nova Compra</Button>
                </DialogTrigger>
                <DialogContent>
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
                      <Input type="number" step="0.01" value={purchaseValorParcela} onChange={(e) => setPurchaseValorParcela(e.target.value)} required />
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
                      <Button type="submit">Adicionar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cartoes.map((c: CartaoCredito) => {
              const totalMes = purchasesAsDividas
                .filter(pd => pd.descricao.startsWith(`Cartão ${c.nome}`))
                .reduce((s, d) => s + getMonthlyDue(d), 0);
              const comprasDoCartao = (comprasCartao as CompraCartao[]).filter(p => p.cardId === c.id);
              return (
                <div key={c.id} className="border rounded p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> <span className="font-medium">{c.nome}</span></div>
                    <div className="flex items-center gap-2 flex-wrap md:justify-end">
                      <div className="text-sm whitespace-nowrap">Fatura do mês: <span className="font-medium">R$ {totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="text-sm whitespace-nowrap">
                        {(() => {
                          // Verificar se todas as parcelas do cartão no mês estão pagas
                          const parcelasDoCartao = (gastosFixos as any[]).filter(g => 
                            g.id.startsWith(`cartao:${c.id}:`) && g.id.endsWith(selectedMonth)
                          );
                          const todasPagas = parcelasDoCartao.length > 0 && parcelasDoCartao.every(p => p.pago);
                          return todasPagas ? (
                            <span className="text-green-600 font-medium">✓ Fatura paga</span>
                          ) : (
                            <span className="text-orange-600 font-medium">⏳ Pendente</span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                        <button title="Editar" onClick={() => openEditCard(c)} className="p-2 text-muted-foreground hover:text-foreground">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button title="Excluir" onClick={() => handleDeleteCard(c.id)} className="p-2 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button className="text-xs text-muted-foreground mt-2 underline" onClick={() => setExpandedCardId(expandedCardId === c.id ? null : c.id)}>
                    {expandedCardId === c.id ? 'Ocultar compras' : 'Ver compras'}
                  </button>
                  {expandedCardId === c.id && (
                    <div className="mt-2 text-sm overflow-x-auto">
                      {comprasDoCartao.length === 0 && <div className="text-muted-foreground">Sem compras</div>}
                      {comprasDoCartao.map((p) => (
                        <div key={p.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 py-1">
                          <div>{p.descricao} — {p.parcelasPagas || 0}/{p.parcelas} parcelas — compra em {new Date(p.dataCompra).toLocaleDateString('pt-BR')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Editar Cartão */}
      <Dialog open={isEditCardDialogOpen} onOpenChange={setIsEditCardDialogOpen}>
        <DialogContent>
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

      {/* Progresso geral */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso Geral</CardTitle>
          <CardDescription>Percentual pago do total das dívidas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={totalDividas > 0 ? (totalPago / totalDividas) * 100 : 0} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pago</span>
              <span>{totalDividas > 0 ? ((totalPago / totalDividas) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de dívidas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Dívidas</CardTitle>
          <CardDescription>
            {dividas.length + purchasesAsDividas.length} dívida(s) registrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Versão mobile - Lista de cards */}
          <div className="md:hidden space-y-3">
            {listDividasForMonth.map((divida) => {
              const percentualPago = (divida.valorPago / divida.valorTotal) * 100;
              const restante = divida.valorTotal - divida.valorPago;
              const isQuitada = divida.valorPago >= divida.valorTotal;
              const parcelaMes = getMonthlyDue(divida);
              
              return (
                <div key={divida.id} className={`border rounded-lg p-3 space-y-3 ${isQuitada ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center">
                        {isQuitada && <CheckCircle className="h-4 w-4 text-green-600 mr-2" />}
                        <p className="font-medium">{divida.descricao}</p>
                      </div>
                      <Badge variant={divida.tipo === 'parcelada' ? 'default' : 'secondary'} className="text-xs">
                        {divida.tipo === 'parcelada' 
                          ? `${divida.parcelasPagas}/${divida.parcelas} parcelas`
                          : 'Valor total'
                        }
                      </Badge>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(divida.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-sm text-muted-foreground">Parcela do mês: <span className="font-medium text-foreground">R$ {parcelaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium">
                        R$ {divida.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className={`text-sm font-medium ${restante > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Restante: R$ {restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Progress value={percentualPago} className="h-2" />
                      <span className="text-xs text-muted-foreground">
                        {percentualPago.toFixed(1)}% pago
                      </span>
                    </div>
                    
                    <div className="flex justify-end space-x-1">
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
              );
            })}
          </div>

          {/* Versão desktop - Tabela */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
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
                  const percentualPago = (divida.valorPago / divida.valorTotal) * 100;
                  const restante = divida.valorTotal - divida.valorPago;
                  const isQuitada = divida.valorPago >= divida.valorTotal;
                  const parcelaMes = getMonthlyDue(divida);
                  
                  return (
                    <TableRow key={divida.id} className={isQuitada ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          {isQuitada && <CheckCircle className="h-4 w-4 text-green-600 mr-2" />}
                          {divida.descricao}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={divida.tipo === 'parcelada' ? 'default' : 'secondary'}>
                          {divida.tipo === 'parcelada' 
                            ? `${divida.parcelasPagas}/${divida.parcelas} parcelas`
                            : 'Valor total'
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                          {new Date(divida.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
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
          
          {(dividas.length === 0 && purchasesAsDividas.length === 0) && (
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
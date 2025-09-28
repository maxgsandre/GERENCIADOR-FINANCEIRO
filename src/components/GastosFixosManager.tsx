import React, { useContext, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Trash2, Plus, Edit, Calendar, AlertCircle, Tag, CheckCircle, Circle, DollarSign, Lock } from 'lucide-react';
import { FinanceiroContext, GastoFixo, Divida } from '../App';
import CategoriasManager from './CategoriasManager';

export default function GastosFixosManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { gastosFixos, setGastosFixos, categorias, setCategorias, saveGastoFixo, deleteGastoFixo, saveCategoria, caixas, setCaixas, saveCaixa, dividas, setDividas, saveDivida, saveTransacao, deleteTransacao, transacoes, cartoes } = context as any;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoriaDialogOpen, setIsCategoriaDialogOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoFixo | null>(null);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    categoria: '',
    diaVencimento: '',
    pago: false,
  });
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);
  const [gastoSelecionado, setGastoSelecionado] = useState<GastoFixo | null>(null);
  const [caixaPagamento, setCaixaPagamento] = useState<string | null>(null);
  const [modoPagamento, setModoPagamento] = useState<'pay' | 'refund'>('pay');
  const [isValorPagoOpen, setIsValorPagoOpen] = useState(false);
  const [valorPagoInput, setValorPagoInput] = useState('');
  const caixaSelecionado = caixas?.find((c: any) => c.id === caixaPagamento) || null;
  
  
  // Monitora exclusão de transações de gastos fixos (versão simplificada)
  useEffect(() => {
    if (!transacoes || !Array.isArray(transacoes)) return;
    
    const transacoesGastosFixos = (transacoes as any[]).filter(t => 
      t.descricao && t.descricao.includes('Gasto fixo pago:')
    );
    
    // Para cada gasto fixo, verifica se ainda tem transação correspondente
    (gastosFixos as GastoFixo[]).forEach(gasto => {
      const descricaoEsperada = `Gasto fixo pago: ${gasto.descricao}`;
      const temTransacao = transacoesGastosFixos.some(t => t.descricao === descricaoEsperada);
      
      // Se o gasto tem valorPago > 0 mas não tem transação correspondente, reverte
      if (gasto.valorPago && gasto.valorPago > 0 && !temTransacao) {
        console.log('Revertendo pagamento para:', gasto.descricao);
        reverterPagamentoGastoFixo(gasto.id);
      }
    });
  }, [transacoes]); // Só executa quando transacoes mudam
  const saldoInsuficiente = modoPagamento === 'pay' && caixaSelecionado && gastoSelecionado ? (caixaSelecionado.saldo < gastoSelecionado.valor) : false;

  // Mês selecionado para exibição (filtrar parcelas geradas por mês)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Filtrar gastos fixos pelo mês selecionado
  const [anoSelecionado, mesSelecionado] = selectedMonth.split('-').map(Number);
  
  const includeInSelectedMonth = (g: GastoFixo) => {
    const id = g.id || '';
    if (id.startsWith('cartao:') || id.startsWith('divida:')) {
      const parts = id.split(':');
      const ym = parts[parts.length - 1];
      return ym === selectedMonth;
    }
    return true; // gastos fixos recorrentes (ex.: Aluguel)
  };

  const filteredGastos = (gastosFixos as GastoFixo[]).filter(includeInSelectedMonth);
  
  // Consolidar gastos de cartão por cartão e esporádicos em uma linha
  const gastosConsolidados = (() => {
    const gastosManuais = filteredGastos.filter(g => !g.id.startsWith('cartao:') && !g.id.startsWith('divida:'));
    
    // Consolidar gastos de cartão por cartão
    const gastosCartao = filteredGastos.filter(g => g.id.startsWith('cartao:'));
    const cartoesConsolidados = new Map<string, GastoFixo>();
    
    gastosCartao.forEach(gasto => {
      const parts = gasto.id.split(':');
      const cardId = parts[1];
      const cardKey = `cartao:${cardId}:${selectedMonth}`;
      
      if (cartoesConsolidados.has(cardKey)) {
        const existente = cartoesConsolidados.get(cardKey)!;
        existente.valor += gasto.valor;
        existente.valorPago = (existente.valorPago || 0) + (gasto.valorPago || 0);
        existente.pago = existente.pago && gasto.pago; // só é pago se todos forem pagos
      } else {
        // Buscar o nome do cartão pelo cardId
        const nomeCartao = (cartoes as any[]).find(c => c.id === cardId)?.nome || 'Desconhecido';
        
        cartoesConsolidados.set(cardKey, {
          ...gasto,
          id: cardKey,
          descricao: `Cartão ${nomeCartao}`,
          categoria: 'Cartão de Crédito',
          // Usar o dia de vencimento do cartão para a data ajustada
          diaVencimento: (cartoes as any[]).find(c => c.id === cardId)?.diaVencimento || gasto.diaVencimento
        });
      }
    });
    
    // Consolidar esporádicos em uma única linha
    const gastosEsporadicos = filteredGastos.filter(g => g.id.startsWith('divida:'));
    const esporadicosConsolidados = new Map<string, GastoFixo>();
    
    gastosEsporadicos.forEach(gasto => {
      const esporadicoKey = `esporadicos:${selectedMonth}`;
      
      if (esporadicosConsolidados.has(esporadicoKey)) {
        const existente = esporadicosConsolidados.get(esporadicoKey)!;
        existente.valor += gasto.valor;
        existente.valorPago = (existente.valorPago || 0) + (gasto.valorPago || 0);
        existente.pago = existente.pago && gasto.pago; // só é pago se todos forem pagos
      } else {
        esporadicosConsolidados.set(esporadicoKey, {
          ...gasto,
          id: esporadicoKey,
          descricao: 'Esporádicos',
          categoria: 'Esporádicos',
          diaVencimento: gasto.diaVencimento
        });
      }
    });
    
    return [...gastosManuais, ...cartoesConsolidados.values(), ...esporadicosConsolidados.values()];
  })();
  
  const gastosComDataAjustada = gastosConsolidados.map(gasto => {
    // Para gastos fixos manuais, usar diaVencimento diretamente
    if (!gasto.id.startsWith('cartao:') && !gasto.id.startsWith('divida:')) {
      const diaVencimento = gasto.diaVencimento;
      const novaData = new Date(anoSelecionado, mesSelecionado - 1, diaVencimento);
      
      return {
        ...gasto,
        dataVencimentoAjustada: novaData.toISOString().split('T')[0]
      };
    }
    
    // Para gastos de cartão consolidados, usar diaVencimento do cartão
    if (gasto.id.startsWith('cartao:')) {
      const diaVencimento = gasto.diaVencimento;
      const novaData = new Date(anoSelecionado, mesSelecionado - 1, diaVencimento);
      
      return {
        ...gasto,
        dataVencimentoAjustada: novaData.toISOString().split('T')[0]
      };
    }
    
    // Para gastos vinculados a dívidas, usar dataVencimento
    if (!gasto.dataVencimento) {
      return {
        ...gasto,
        dataVencimentoAjustada: gasto.dataVencimento
      };
    }
    
    const dataOriginal = new Date(gasto.dataVencimento);
    const diaVencimento = dataOriginal.getDate();
    
    // Validar se a data é válida
    if (isNaN(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
      return {
        ...gasto,
        dataVencimentoAjustada: gasto.dataVencimento
      };
    }
    
    // Criar nova data com o dia original mas mês/ano selecionado
    const novaData = new Date(anoSelecionado, mesSelecionado - 1, diaVencimento);
    
    // Validar se a nova data é válida
    if (isNaN(novaData.getTime())) {
      return {
        ...gasto,
        dataVencimentoAjustada: gasto.dataVencimento
      };
    }
    
    return {
      ...gasto,
      dataVencimentoAjustada: novaData.toISOString().split('T')[0]
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descricao || !formData.valor || !formData.categoria || !formData.diaVencimento) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const valorNumerico = parseFloat(formData.valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      alert('Por favor, insira um valor válido maior que zero.');
      return;
    }

    const diaVencimentoNumerico = parseInt(formData.diaVencimento);
    if (isNaN(diaVencimentoNumerico) || diaVencimentoNumerico < 1 || diaVencimentoNumerico > 31) {
      alert('Por favor, insira um dia de vencimento válido (1-31).');
      return;
    }

    const novoGasto: GastoFixo = {
      id: editingGasto?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString()),
      descricao: formData.descricao,
      valor: valorNumerico,
      categoria: formData.categoria,
      diaVencimento: diaVencimentoNumerico,
      pago: formData.pago,
    };

    await saveGastoFixo(novoGasto);
    setGastosFixos(prev => {
      const index = prev.findIndex(g => g.id === novoGasto.id);
      if (index >= 0) {
        const clone = [...prev];
        clone[index] = novoGasto;
        return clone;
      }
      return [...prev, novoGasto];
    });

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valor: '',
      categoria: '',
      diaVencimento: '',
      pago: false,
    });
    setEditingGasto(null);
    setIsDialogOpen(false);
  };

  const handleAdicionarCategoria = async () => {
    if (novaCategoria.trim() && !categorias.some(cat => cat.nome.toLowerCase() === novaCategoria.trim().toLowerCase())) {
      const novaId = (Math.max(...categorias.map(c => parseInt(c.id))) + 1).toString();
      await saveCategoria({ id: novaId, nome: novaCategoria.trim() });
      setFormData(prev => ({ ...prev, categoria: novaCategoria.trim() }));
      setNovaCategoria('');
      setIsCategoriaDialogOpen(false);
    }
  };

  const handleEdit = (gasto: GastoFixo) => {
    // Verificar se é um gasto vinculado a dívida ou cartão
    if (gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:')) {
      alert('Este gasto está vinculado a uma dívida. Para editá-lo, modifique a dívida correspondente na seção "Dívidas".');
      return;
    }
    
    setEditingGasto(gasto);
    setFormData({
      descricao: gasto.descricao,
      valor: gasto.valor.toString(),
      categoria: gasto.categoria,
      diaVencimento: gasto.diaVencimento.toString(),
      pago: gasto.pago,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    // Verificar se é um gasto vinculado a dívida ou cartão
    if (id.startsWith('divida:') || id.startsWith('cartao:')) {
      alert('Este gasto está vinculado a uma dívida. Para excluí-lo, remova a dívida correspondente na seção "Dívidas".');
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este gasto fixo?')) return;
    await deleteGastoFixo(id);
  };

  const getStatusGasto = (gasto: GastoFixo) => {
    const valorPago = gasto.valorPago || 0;
    if (valorPago === 0) return { status: 'Pendente', cor: 'text-red-600' };
    if (valorPago >= gasto.valor) return { status: 'Pago', cor: 'text-green-600' };
    return { status: 'Pago Parcial', cor: 'text-orange-600' };
  };

  const abrirModalValorPago = (gasto: GastoFixo) => {
    setGastoSelecionado(gasto);
    setValorPagoInput(gasto.valorPago?.toString() || '');
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setIsValorPagoOpen(true);
  };

  // Função para reverter pagamento quando transação é excluída
  const reverterPagamentoGastoFixo = async (gastoId: string) => {
    try {
      const gasto = (gastosFixos as GastoFixo[]).find(g => g.id === gastoId);
      if (!gasto) {
        console.log('Gasto não encontrado:', gastoId);
        return;
      }

      console.log('Revertendo pagamento do gasto:', gasto.descricao, 'de', gasto.valorPago, 'para 0');
      const gastoAtualizado = { ...gasto, valorPago: 0, pago: false };
      await saveGastoFixo(gastoAtualizado);
      setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === gastoId ? gastoAtualizado : g));
      console.log('Pagamento revertido com sucesso');
    } catch (error) {
      console.error('Erro ao reverter pagamento:', error);
    }
  };

  const confirmarValorPago = async () => {
    if (!gastoSelecionado || !caixaPagamento) return;
    const valorPago = parseFloat(valorPagoInput) || 0;
    
    if (valorPago <= 0) {
      alert('Valor deve ser maior que zero.');
      return;
    }
    
    // Verificar saldo do caixa
    const caixa = (caixas || []).find((x: any) => x.id === caixaPagamento);
    if (caixa && caixa.saldo < valorPago) {
      alert('Saldo insuficiente no caixa selecionado.');
      return;
    }
    
    // Verificar se é um gasto consolidado (cartão ou esporádicos)
    // Gastos consolidados têm IDs como: cartao:cardId:mes ou esporadicos:mes
    const isGastoConsolidado = (gastoSelecionado.id.startsWith('cartao:') && gastoSelecionado.id.includes(':')) || 
                              gastoSelecionado.id.startsWith('esporadicos:');
    
    if (isGastoConsolidado) {
      // Para gastos consolidados, não salvar no Firebase - apenas atualizar as parcelas individuais
      
      // Atualizar saldo do caixa e salvar transação
      if (caixa) {
        const novoSaldo = caixa.saldo - valorPago;
        await (saveCaixa && (saveCaixa as any)({ ...caixa, saldo: novoSaldo }));
        
        await (saveTransacao && saveTransacao({
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'saida',
          valor: valorPago,
          descricao: `Gasto fixo pago: ${gastoSelecionado.descricao}`,
          categoria: gastoSelecionado.categoria || 'Outros',
          data: new Date().toISOString().slice(0,10),
          hora: new Date().toTimeString().slice(0,5)
        }));
      }
    } else {
      // Para gastos manuais normais, salvar normalmente
      const gastoAtualizado = { ...gastoSelecionado, valorPago, pago: valorPago >= gastoSelecionado.valor };
      await saveGastoFixo(gastoAtualizado);
      setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === gastoSelecionado.id ? gastoAtualizado : g));
      
      // Atualizar saldo do caixa e salvar transação
      if (caixa) {
        const novoSaldo = caixa.saldo - valorPago;
        await (saveCaixa && (saveCaixa as any)({ ...caixa, saldo: novoSaldo }));
        
        await (saveTransacao && saveTransacao({
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'saida',
          valor: valorPago,
          descricao: `Gasto fixo pago: ${gastoSelecionado.descricao}`,
          categoria: gastoSelecionado.categoria || 'Outros',
          data: new Date().toISOString().slice(0,10),
          hora: new Date().toTimeString().slice(0,5)
        }));
      }
    }
    
    setIsValorPagoOpen(false);
    setGastoSelecionado(null);
    setValorPagoInput('');
  };

  const togglePago = (id: string) => {
    // Se for um gasto consolidado de cartão, marcar todas as parcelas
    if (id.startsWith('cartao:') && id.includes(selectedMonth)) {
      const parts = id.split(':');
      const cardId = parts[1];
      
      // Encontrar todas as parcelas deste cartão no mês selecionado
      const parcelasDoCartao = gastosFixos.filter(g => 
        g.id.startsWith(`cartao:${cardId}:`) && g.id.endsWith(selectedMonth)
      );
      
      if (parcelasDoCartao.length === 0) return;
      
      // Verificar se todas estão pagas
      const todasPagas = parcelasDoCartao.every(p => p.pago);
      
      if (!todasPagas) {
        // Marcar todas como pagas
        const totalValor = parcelasDoCartao.reduce((sum, p) => sum + p.valor, 0);
        const gastoConsolidado = {
          ...parcelasDoCartao[0],
          id: id,
          valor: totalValor,
          pago: false
        };
        
        setGastoSelecionado(gastoConsolidado);
        setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
        setModoPagamento('pay');
        setIsPagamentoOpen(true);
        return;
      } else {
        // Desmarcar todas
        if (!confirm('Desmarcar pagamento e estornar?')) return;
        
        const totalValor = parcelasDoCartao.reduce((sum, p) => sum + p.valor, 0);
        const gastoConsolidado = {
          ...parcelasDoCartao[0],
          id: id,
          valor: totalValor,
          pago: true
        };
        
        setGastoSelecionado(gastoConsolidado);
        setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
        setModoPagamento('refund');
        setIsPagamentoOpen(true);
        return;
      }
    }
    
    const gasto = gastosFixos.find(g => g.id === id);
    if (!gasto) return;
    const isLinkedDivida = gasto.id.startsWith('divida:');
    const isLinkedCartao = gasto.id.startsWith('cartao:');
    const isLinked = isLinkedDivida || isLinkedCartao;
    if (!gasto.pago && isLinked) {
      setGastoSelecionado(gasto);
      setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
      setModoPagamento('pay');
      setIsPagamentoOpen(true);
      return;
    }
    if (gasto.pago && isLinked) {
      if (!confirm('Desmarcar pagamento e estornar?')) return;
      setGastoSelecionado(gasto);
      setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
      setModoPagamento('refund');
      setIsPagamentoOpen(true);
      return;
    }
    const atualizado = { ...gasto, pago: !gasto.pago };
    setGastosFixos(prev => prev.map(g => g.id === id ? atualizado : g));
    saveGastoFixo && saveGastoFixo(atualizado);
  };

  const ymToIndex = (year: number, month1to12: number) => year * 12 + (month1to12 - 1);

  const confirmarPagamentoVinculado = async () => {
    if (!gastoSelecionado || !caixaPagamento) return;
    const gasto = gastoSelecionado;
    
    // Se for um gasto consolidado de cartão, marcar todas as parcelas
    if (gasto.id.startsWith('cartao:') && gasto.id.includes(selectedMonth)) {
      const parts = gasto.id.split(':');
      const cardId = parts[1];
      
      // Encontrar todas as parcelas deste cartão no mês selecionado
      const parcelasDoCartao = gastosFixos.filter(g => 
        g.id.startsWith(`cartao:${cardId}:`) && g.id.endsWith(selectedMonth)
      );
      
      // Marcar todas as parcelas como pagas e sincronizar com compras de cartão
      for (const parcela of parcelasDoCartao) {
        const parcelaPaga = { ...parcela, pago: true };
        await (saveGastoFixo && saveGastoFixo(parcelaPaga));
        setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === parcela.id ? parcelaPaga : g));
        
        // Sincronizar com as compras de cartão nas dívidas
        const parcelaParts = parcela.id.split(':');
        const purchaseId = parcelaParts[2];
        const compra = (context as any).comprasCartao?.find((c: any) => c.id === purchaseId);
        if (compra) {
          // Contar parcelas pagas baseado nos gastos fixos
          const parcelasPagasNosGastosFixos = gastosFixos.filter(g => 
            g.id.startsWith(`cartao:${compra.cardId}:${compra.id}:`) && g.pago
          ).length;
          
          const compraAtualizada = { ...compra, parcelasPagas: parcelasPagasNosGastosFixos };
          await (context as any).saveCompraCartao(compraAtualizada);
          (context as any).setComprasCartao((prev: any[]) => prev.map((c: any) => c.id === compra.id ? compraAtualizada : c));
        }
      }
    } else {
      // Marcar gasto como pago (comportamento normal)
      const gastoPago = { ...gasto, pago: true };
      await (saveGastoFixo && saveGastoFixo(gastoPago));
      setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === gasto.id ? gastoPago : g));
    }

    // Extrair dividaId e YYYY-MM do id do gasto: divida:{id}:{YYYY-MM}
    const parts = gasto.id.split(':');
    if (parts.length >= 3) {
      const prefix = parts[0];
      if (prefix === 'divida') {
        const dividaId = parts[1];
        const ym = parts[2];
        const d = dividas.find((x: Divida) => x.id === dividaId);
        if (d) {
          const [yy, mm] = ym.split('-').map(Number);
          const [sy, sm] = d.dataVencimento.split('-').slice(0,2).map(Number);
          const idx = ymToIndex(yy, mm) - ymToIndex(sy, sm);
          const novoValorPago = d.valorPago + gasto.valor;
          const novasParcelasPagas = d.tipo === 'parcelada' ? Math.max(d.parcelasPagas, Math.min(d.parcelas, idx + 1)) : (novoValorPago >= d.valorTotal ? 1 : d.parcelasPagas);
          const atualizada: Divida = { ...d, valorPago: novoValorPago, parcelasPagas: novasParcelasPagas };
          await (saveDivida && saveDivida(atualizada));
          setDividas((prev: Divida[]) => prev.map(x => x.id === d.id ? atualizada : x));
        }
      }
      if (prefix === 'cartao') {
        // parts: cartao:{cardId}:{purchaseId}:{YYYY-MM}
        const purchaseId = parts[2];
        const purchases = (context as any).comprasCartao as any[];
        const savePurchase = (context as any).saveCompraCartao as (p: any) => Promise<void>;
        const purchase = purchases?.find(p => p.id === purchaseId);
        if (purchase) {
          const atualizada = { ...purchase, parcelasPagas: Math.min(purchase.parcelas, (purchase.parcelasPagas || 0) + 1) };
          await (savePurchase && savePurchase(atualizada));
          (context as any).setComprasCartao((prev: any[]) => prev.map(p => p.id === atualizada.id ? atualizada : p));
        }
      }
    }

    // Atualizar saldo do caixa (bloqueio de negativo) e lançar saída
    try {
      const caixa = (caixas || []).find((x: any) => x.id === caixaPagamento);
      if (caixa) {
        const novoSaldo = caixa.saldo - gasto.valor;
        if (novoSaldo < 0) { alert('Saldo insuficiente no caixa selecionado.'); return; }
        await (saveCaixa && (saveCaixa as any)({ ...caixa, saldo: novoSaldo }));
      }
      await (saveTransacao && saveTransacao({
        id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
        caixaId: caixaPagamento,
        tipo: 'saida',
        valor: gasto.valor,
        descricao: `Gasto fixo pago: ${gasto.descricao}`,
        categoria: 'Dívidas',
        data: new Date().toISOString().slice(0,10),
        hora: new Date().toTimeString().slice(0,5)
      }));
    } catch {}

    setIsPagamentoOpen(false);
    setGastoSelecionado(null);
  };

  const confirmarEstornoVinculado = async () => {
    if (!gastoSelecionado || !caixaPagamento) return;
    const gasto = gastoSelecionado;
    
    // Se for um gasto consolidado de cartão, desmarcar todas as parcelas
    if (gasto.id.startsWith('cartao:') && gasto.id.includes(selectedMonth)) {
      const parts = gasto.id.split(':');
      const cardId = parts[1];
      
      // Encontrar todas as parcelas deste cartão no mês selecionado
      const parcelasDoCartao = gastosFixos.filter(g => 
        g.id.startsWith(`cartao:${cardId}:`) && g.id.endsWith(selectedMonth)
      );
      
      // Desmarcar todas as parcelas e sincronizar com compras de cartão
      for (const parcela of parcelasDoCartao) {
        const parcelaNaoPaga = { ...parcela, pago: false };
        await (saveGastoFixo && saveGastoFixo(parcelaNaoPaga));
        setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === parcela.id ? parcelaNaoPaga : g));
        
        // Sincronizar com as compras de cartão nas dívidas
        const parcelaParts = parcela.id.split(':');
        const purchaseId = parcelaParts[2];
        const compra = (context as any).comprasCartao?.find((c: any) => c.id === purchaseId);
        if (compra) {
          // Contar parcelas pagas baseado nos gastos fixos
          const parcelasPagasNosGastosFixos = gastosFixos.filter(g => 
            g.id.startsWith(`cartao:${compra.cardId}:${compra.id}:`) && g.pago
          ).length;
          
          const compraAtualizada = { ...compra, parcelasPagas: parcelasPagasNosGastosFixos };
          await (context as any).saveCompraCartao(compraAtualizada);
          (context as any).setComprasCartao((prev: any[]) => prev.map((c: any) => c.id === compra.id ? compraAtualizada : c));
        }
      }
    } else {
      // Marcar gasto como não pago (comportamento normal)
      const gastoNaoPago = { ...gasto, pago: false };
      await (saveGastoFixo && saveGastoFixo(gastoNaoPago));
      setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === gasto.id ? gastoNaoPago : g));
    }

    // Atualizar dívida (subtrair valor e recalcular parcelasPagas)
    const parts = gasto.id.split(':');
    if (parts.length >= 3) {
      const dividaId = parts[1];
      const d = dividas.find((x: Divida) => x.id === dividaId);
      if (d) {
        const novoValorPago = Math.max(0, d.valorPago - gasto.valor);
        const novasParcelasPagas = d.tipo === 'parcelada' ? Math.floor(novoValorPago / d.valorParcela) : (novoValorPago >= d.valorTotal ? 1 : 0);
        const atualizada: Divida = { ...d, valorPago: novoValorPago, parcelasPagas: Math.min(novasParcelasPagas, d.parcelas) };
        await (saveDivida && saveDivida(atualizada));
        setDividas((prev: Divida[]) => prev.map(x => x.id === d.id ? atualizada : x));
      }
    }

    // Atualizar saldo do caixa e lançar entrada de estorno
    try {
      const caixa = (caixas || []).find((x: any) => x.id === caixaPagamento);
      if (caixa) {
        const novoSaldo = caixa.saldo + gasto.valor;
        await (saveCaixa && (saveCaixa as any)({ ...caixa, saldo: novoSaldo }));
      }
      await (saveTransacao && saveTransacao({
        id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
        caixaId: caixaPagamento,
        tipo: 'entrada',
        valor: gasto.valor,
        descricao: `Estorno gasto fixo: ${gasto.descricao}`,
        categoria: 'Dívidas',
        data: new Date().toISOString().slice(0,10),
        hora: new Date().toTimeString().slice(0,5)
      }));
    } catch {}

    setIsPagamentoOpen(false);
    setGastoSelecionado(null);
  };

  // Calcular totais (gastos fixos são sempre visíveis)
  const totalPagos = gastosComDataAjustada
    .filter(g => g.pago)
    .reduce((sum, g) => sum + g.valor, 0);

  const totalPendentes = gastosComDataAjustada
    .filter(g => !g.pago)
    .reduce((sum, g) => sum + g.valor, 0);

  // Verificar vencimentos próximos (próximos 7 dias) que ainda não foram pagos
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const proximosVencimentos = gastosComDataAjustada
    .filter(g => !g.pago)
    .filter(g => {
      const diasAteVencimento = g.diaVencimento - diaAtual;
      return diasAteVencimento >= 0 && diasAteVencimento <= 7;
    })
    .sort((a, b) => a.diaVencimento - b.diaVencimento);

  // Gastos por categoria (todos os gastos)
  const gastosPorCategoria = gastosComDataAjustada
    .reduce((acc, gasto) => {
      acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.valor;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Modal pagamento vinculado a dívida */}
      <Dialog open={isPagamentoOpen} onOpenChange={setIsPagamentoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modoPagamento === 'pay' ? 'Pagar gasto fixo' : 'Estornar gasto fixo'}</DialogTitle>
            <DialogDescription>
              {gastoSelecionado?.id.startsWith('cartao:') && gastoSelecionado.id.includes(selectedMonth) 
                ? `Cartão ${(cartoes as any[]).find(c => c.id === gastoSelecionado.id.split(':')[1])?.nome || 'Desconhecido'}`
                : gastoSelecionado?.descricao}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
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
            <p className="text-sm text-muted-foreground">Valor: <strong>R$ {gastoSelecionado?.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
            {caixaSelecionado && (
              <p className={`text-sm ${saldoInsuficiente ? 'text-red-600' : 'text-muted-foreground'}`}>Saldo do caixa: <strong>R$ {caixaSelecionado.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
            )}
            {saldoInsuficiente && (
              <p className="text-sm text-red-600">Saldo insuficiente. Selecione outro caixa ou ajuste o valor.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPagamentoOpen(false)}>Cancelar</Button>
            {modoPagamento === 'pay' ? (
              <Button onClick={confirmarPagamentoVinculado} disabled={!caixaPagamento || saldoInsuficiente}>Confirmar pagamento</Button>
            ) : (
              <Button onClick={confirmarEstornoVinculado} disabled={!caixaPagamento}>Confirmar estorno</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal valor pago */}
      <Dialog open={isValorPagoOpen} onOpenChange={setIsValorPagoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir valor pago</DialogTitle>
            <DialogDescription>
              {gastoSelecionado?.descricao}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valorPago">Valor pago</Label>
              <Input
                id="valorPago"
                type="number"
                step="0.01"
                value={valorPagoInput}
                onChange={(e) => setValorPagoInput(e.target.value)}
                placeholder="0.00"
                max={gastoSelecionado?.valor}
              />
              <p className="text-sm text-muted-foreground">
                Valor total: R$ {gastoSelecionado?.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="caixaPagamento">Caixa para débito</Label>
              <Select value={caixaPagamento || ''} onValueChange={setCaixaPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o caixa" />
                </SelectTrigger>
                <SelectContent>
                  {caixas?.map((caixa: any) => (
                    <SelectItem key={caixa.id} value={caixa.id}>
                      {caixa.nome} - R$ {caixa.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {caixaPagamento && (() => {
                const caixa = caixas?.find((c: any) => c.id === caixaPagamento);
                const valorPago = parseFloat(valorPagoInput) || 0;
                return caixa && valorPago > caixa.saldo ? (
                  <p className="text-sm text-red-600">Saldo insuficiente no caixa selecionado</p>
                ) : null;
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsValorPagoOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarValorPago}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gastos Fixos</h2>
          <p className="text-muted-foreground">
            Gerencie seus gastos recorrentes mensais
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Gasto Fixo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGasto ? 'Editar Gasto Fixo' : 'Novo Gasto Fixo'}
              </DialogTitle>
              <DialogDescription>
                {editingGasto 
                  ? 'Edite as informações do gasto fixo selecionado.'
                  : 'Adicione um novo gasto que se repete mensalmente.'
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
                  placeholder="Ex: Aluguel, Internet, Academia, etc."
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Permitir apenas números e ponto decimal
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setFormData(prev => ({ ...prev, valor: value }));
                      }
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="diaVencimento">Dia do Vencimento</Label>
                  <Input
                    id="diaVencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.diaVencimento}
                    onChange={(e) => setFormData(prev => ({ ...prev, diaVencimento: e.target.value }))}
                    placeholder="Ex: 5, 15, 30"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="categoria">Categoria</Label>
                  <div className="flex items-center space-x-2">
                    <Dialog open={isCategoriaDialogOpen} onOpenChange={setIsCategoriaDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Nova
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Nova Categoria</DialogTitle>
                          <DialogDescription>
                            Crie uma nova categoria personalizada para seus gastos fixos.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="nova-categoria-gasto">Nome da Categoria</Label>
                            <Input
                              id="nova-categoria-gasto"
                              value={novaCategoria}
                              onChange={(e) => setNovaCategoria(e.target.value)}
                              placeholder="Ex: Pets, Presentes, Streaming..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAdicionarCategoria();
                                }
                              }}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setNovaCategoria('');
                              setIsCategoriaDialogOpen(false);
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            type="button" 
                            onClick={handleAdicionarCategoria}
                            disabled={!novaCategoria.trim()}
                          >
                            <Tag className="h-4 w-4 mr-2" />
                            Criar Categoria
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <CategoriasManager onCategoriaSelect={(categoria) => setFormData(prev => ({ ...prev, categoria }))} />
                  </div>
                </div>
                <Select 
                  value={formData.categoria} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.sort((a, b) => a.nome.localeCompare(b.nome)).map(categoria => (
                      <SelectItem key={categoria.id} value={categoria.nome}>
                        {categoria.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="pago"
                  checked={formData.pago}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, pago: checked }))}
                />
                <Label htmlFor="pago">Gasto já pago neste mês</Label>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingGasto ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de resumo */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">Mês</div>
        <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-[180px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Gastos Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalPagos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {gastosFixos.filter(g => g.pago).length} gasto(s) pago(s)
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Gastos Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {gastosFixos.filter(g => !g.pago).length} gasto(s) pendente(s)
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Próximos Vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {proximosVencimentos.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              nos próximos 7 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de vencimento próximo */}
      {proximosVencimentos.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertCircle className="h-4 w-4 mr-2" />
              Vencimentos Próximos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {proximosVencimentos.map(gasto => (
                <div key={gasto.id} className="flex justify-between items-center">
                  <span className="text-orange-800">{gasto.descricao}</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-orange-800 border-orange-300">
                      Dia {gasto.diaVencimento}
                    </Badge>
                    <span className="font-medium text-orange-800">
                      R$ {gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo por categoria */}
      {Object.keys(gastosPorCategoria).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
            <CardDescription>Distribuição dos gastos mensais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(gastosPorCategoria)
                .sort(([,a], [,b]) => b - a)
                .map(([categoria, valor]) => (
                  <div key={categoria} className="flex justify-between items-center">
                    <span>{categoria}</span>
                    <span className="font-medium">
                      R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de gastos fixos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Gastos Fixos</CardTitle>
          <CardDescription>
            {gastosFixos.length} gasto(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Versão mobile - Lista de cards */}
          <div className="md:hidden space-y-3">
            {gastosComDataAjustada.map((gasto) => (
              <div key={gasto.id} className={`border rounded-lg p-3 space-y-3`}>
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <p className="font-medium">{gasto.descricao}</p>
                    <p className="text-sm text-muted-foreground">{gasto.categoria}</p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-1" />
                      {gasto.dataVencimentoAjustada ? gasto.dataVencimentoAjustada.split('-').reverse().join('/') : ''}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-medium">
                      R$ {gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirModalValorPago(gasto)}
                      className="text-green-600 hover:text-green-700"
                      title="Definir valor pago"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                    <span className={`text-sm ${getStatusGasto(gasto).cor}`}>
                      {getStatusGasto(gasto).status}
                    </span>
                  </div>
                  
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(gasto)}
                      title={gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? 'Gasto vinculado a dívida - edite na seção Dívidas' : 'Editar gasto'}
                    >
                      {gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Edit className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(gasto.id)}
                      className={gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? "text-muted-foreground" : "text-red-600 hover:text-red-700"}
                      title={gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? 'Gasto vinculado a dívida - exclua na seção Dívidas' : 'Excluir gasto'}
                    >
                      {gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Versão desktop - Tabela */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastosComDataAjustada.map((gasto) => (
                  <TableRow key={gasto.id}>
                    <TableCell className="font-medium">{gasto.descricao}</TableCell>
                    <TableCell>{gasto.categoria}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                        {gasto.dataVencimentoAjustada ? gasto.dataVencimentoAjustada.split('-').reverse().join('/') : ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirModalValorPago(gasto)}
                          className="text-green-600 hover:text-green-700"
                          title="Definir valor pago"
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                        <span className={`text-sm ${getStatusGasto(gasto).cor}`}>
                          {getStatusGasto(gasto).status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(gasto)}
                          title={gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? 'Gasto vinculado a dívida - edite na seção Dívidas' : 'Editar gasto'}
                        >
                          {gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Edit className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(gasto.id)}
                          className={gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? "text-muted-foreground" : "text-red-600 hover:text-red-700"}
                          title={gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? 'Gasto vinculado a dívida - exclua na seção Dívidas' : 'Excluir gasto'}
                        >
                          {gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:') ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {gastosFixos.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum gasto fixo cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece adicionando seus gastos mensais recorrentes.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeiro gasto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
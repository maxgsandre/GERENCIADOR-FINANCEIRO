import React, { useContext, useState, useEffect, useRef } from 'react';
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
import { FinanceiroContext, GastoFixo, Divida, Pagamento, Transacao } from '../App';
import CategoriasManager from './CategoriasManager';

export default function GastosFixosManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { gastosFixos, setGastosFixos, categorias, setCategorias, saveGastoFixo, deleteGastoFixo, saveCategoria, caixas, setCaixas, saveCaixa, dividas, setDividas, saveDivida, saveTransacao, deleteTransacao, transacoes, cartoes, comprasCartao, saveCompraCartao } = context as any;
  
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
  const [valorPagamentoInput, setValorPagamentoInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFracionado, setIsFracionado] = useState(false);
  const [dataPagamento, setDataPagamento] = useState('');
  const [horaPagamento, setHoraPagamento] = useState('');
  const caixaSelecionado = caixas?.find((c: any) => c.id === caixaPagamento) || null;
  const autoCleanRanRef = useRef(false);
  
  
  // Função para limpar gastos fixos criados automaticamente por dívidas
  const limparGastosFixosAutomaticos = async () => {
    if (!gastosFixos || !Array.isArray(gastosFixos)) return;

    // Identificar gastos fixos criados automaticamente por dívidas
    const gastosAutomaticos = (gastosFixos as GastoFixo[]).filter(gasto => 
      gasto.id.startsWith('divida:') || gasto.id.startsWith('cartao:')
    );

    for (const gasto of gastosAutomaticos) {
      try {
        await deleteGastoFixo(gasto.id);
        setGastosFixos((prev: GastoFixo[]) => prev.filter(g => g.id !== gasto.id));
      } catch (error) {
        console.error(`Erro ao remover gasto ${gasto.id}:`, error);
      }
    }
  };

  // Função para verificar e reverter gastos fixos sem transação correspondente
  const verificarEReverterGastosFixos = () => {
    if (!transacoes || !Array.isArray(transacoes) || !gastosFixos || !Array.isArray(gastosFixos)) {
      return;
    }
    
    const transacoesGastosFixos = (transacoes as any[]).filter(t => 
      t.descricao && t.descricao.includes('Gasto fixo pago:')
    );
    
    // Função para obter descrição da transação baseada no tipo de gasto
    const getDescricaoTransacao = (gasto: GastoFixo) => {
      // Para gastos de cartão, usar apenas nome do cartão
      if (gasto.id.startsWith('cartao:') || gasto.descricao.startsWith('Cartão ')) {
        const nomeCartao = gasto.descricao.split(':')[0]; // "Cartão Neon"
        return `Gasto fixo pago: ${nomeCartao}`;
      }
      return `Gasto fixo pago: ${gasto.descricao}`;
    };

    // Para cada gasto fixo marcado como pago (pago: true ou valorPago > 0), verificar se tem transação correspondente
    (gastosFixos as GastoFixo[]).forEach(gasto => {
      // NÃO verificar gastos que têm array pagamentos (novos gastos fracionados)
      if (gasto.pagamentos && gasto.pagamentos.length > 0) {
        return;
      }
      
      const isPago = gasto.pago || (gasto.valorPago && gasto.valorPago > 0);
      
      if (isPago) {
        const descricaoEsperada = getDescricaoTransacao(gasto);
        const temTransacao = transacoesGastosFixos.some(t => t.descricao === descricaoEsperada);
        
        if (!temTransacao) {
          reverterPagamentoGastoFixo(gasto.id);
        }
      }
    });
  };

  // Função para migrar gastos existentes para nova estrutura
  const migrarGastosExistentes = async () => {
    if (!gastosFixos || !Array.isArray(gastosFixos)) return;
    
    const gastosParaMigrar = (gastosFixos as GastoFixo[]).filter(gasto => 
      // Migrar gastos que têm valorPago mas não têm array pagamentos
      (gasto.valorPago && gasto.valorPago > 0) && !gasto.pagamentos
    );
    
    for (const gasto of gastosParaMigrar) {
      // Criar pagamento baseado no valorPago existente
      const pagamentoExistente: Pagamento = {
        id: `${gasto.id}-pagamento-1`,
        valor: gasto.valorPago || 0,
        data: new Date().toISOString().slice(0, 10),
        hora: new Date().toTimeString().slice(0, 5),
        descricao: `Pagamento migrado`
      };
      
      const gastoMigrado = {
        ...gasto,
        pagamentos: [pagamentoExistente],
        fracionado: false // Por padrão, gastos existentes não são fracionados
      };
      
      await saveGastoFixo(gastoMigrado);
      setGastosFixos((prev: GastoFixo[]) => 
        prev.map(g => g.id === gasto.id ? gastoMigrado : g)
      );
    }
  };

  // Auto-limpar gastos fixos criados por dívidas na primeira carga da tela
  useEffect(() => {
    if (autoCleanRanRef.current) return;
    
    try {
      const temAutomaticos = Array.isArray(gastosFixos) && (gastosFixos as GastoFixo[]).some(g => g.id.startsWith('divida:') || g.id.startsWith('cartao:'));
      if (temAutomaticos) {
        limparGastosFixosAutomaticos();
      }
      
      // Migrar gastos existentes para nova estrutura
      migrarGastosExistentes();
      
    } finally {
      autoCleanRanRef.current = true;
    }
  }, [gastosFixos]);

  // Monitora mudanças nas transações e gastos fixos para verificar consistência
  useEffect(() => {
    // Aguardar as operações de gravação (pagar -> salvar gasto -> salvar transação)
    // para evitar falso positivo e reverter logo após o pagamento
    const timeoutId = setTimeout(() => {
      verificarEReverterGastosFixos();
    }, 1200);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [transacoes, gastosFixos]);
  const valorPagamentoNum = parseFloat(valorPagamentoInput.replace(',', '.')) || 0;
  const saldoInsuficiente = modoPagamento === 'pay' && caixaSelecionado && gastoSelecionado ? (caixaSelecionado.saldo < valorPagamentoNum) : false;

  // Preencher automaticamente o valor sugerido ao abrir o modal de pagamento
  useEffect(() => {
    if (isPagamentoOpen && modoPagamento === 'pay' && gastoSelecionado) {
      const valor = typeof (gastoSelecionado as any).valor === 'number' ? (gastoSelecionado as any).valor : parseFloat((gastoSelecionado as any).valor || '0');
      if (isFinite(valor)) {
        setValorPagamentoInput(valor.toFixed(2).replace('.', ','));
      }
    }
  }, [isPagamentoOpen, modoPagamento, gastoSelecionado]);

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
    
    // Mostrar dívidas manuais separadamente (não consolidar)
    const gastosDividas = filteredGastos.filter(g => g.id.startsWith('divida:'));
    // Usar diretamente os gastos individuais sem consolidação
    
    return [...gastosManuais, ...cartoesConsolidados.values(), ...gastosDividas];
  })();
  
  const gastosComDataAjustada = gastosConsolidados
    .map(gasto => {
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
    
    // Para gastos vinculados a dívidas, usar diaVencimento
    const diaVencimento = gasto.diaVencimento;
    
    // Validar se o dia é válido
    if (isNaN(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
      return {
        ...gasto,
        dataVencimentoAjustada: `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`
      };
    }
    
    // Criar nova data com o dia original mas mês/ano selecionado
    const novaData = new Date(anoSelecionado, mesSelecionado - 1, diaVencimento);
    
    // Validar se a nova data é válida
    if (isNaN(novaData.getTime())) {
      return {
        ...gasto,
        dataVencimentoAjustada: `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`
      };
    }
    
    return {
      ...gasto,
      dataVencimentoAjustada: novaData.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-')
    };
  })
  .sort((a, b) => {
    const diaA = a.diaVencimento;
    const diaB = b.diaVencimento;
    return diaA - diaB;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSaving) return;
    
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

    setIsSaving(true);
    
    try {
    const novoGasto: GastoFixo = {
        id: editingGasto?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString()),
      descricao: formData.descricao,
        valor: valorNumerico,
      categoria: formData.categoria,
        diaVencimento: diaVencimentoNumerico,
      pago: formData.pago,
      fracionado: isFracionado,
      // Preservar pagamentos existentes ao editar; iniciar vazio apenas para novo
      pagamentos: editingGasto?.pagamentos ? [...editingGasto.pagamentos] : [],
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
    } finally {
      setIsSaving(false);
    }
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
    setIsFracionado(false);
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
    setIsFracionado(gasto.fracionado || false);
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
    // Para gastos migrados ou novos com array pagamentos
    if (gasto.pagamentos && gasto.pagamentos.length > 0) {
      const valorTotalPago = gasto.pagamentos.reduce((sum, p) => sum + p.valor, 0);
      const valorTotal = gasto.valor;
      
      if (valorTotalPago === 0) {
        return { status: 'Pendente', cor: 'text-red-600' };
      }
      
      if (valorTotalPago >= valorTotal) {
        const excedente = valorTotalPago - valorTotal;
        return { 
          status: excedente > 0 ? `Pago (+R$ ${excedente.toFixed(2)})` : 'Pago',
          cor: 'text-green-600'
        };
      }
      
      const percentual = (valorTotalPago / valorTotal * 100).toFixed(0);
      return { 
        status: `Pago Parcial (${percentual}%)`,
        cor: 'text-orange-600'
      };
    }
    
    // Para gastos antigos (compatibilidade)
    const valorPago = gasto.valorPago || 0;
    if (valorPago === 0) return { status: 'Pendente', cor: 'text-red-600' };
    if (valorPago >= gasto.valor) return { status: 'Pago', cor: 'text-green-600' };
    return { status: 'Pago Parcial', cor: 'text-orange-600' };
  };

  const abrirModalValorPago = (gasto: GastoFixo) => {
    setGastoSelecionado(gasto);
    
    // Para gastos com array pagamentos (novos ou migrados)
    if (gasto.pagamentos && gasto.pagamentos.length > 0) {
      const valorTotalPago = gasto.pagamentos.reduce((sum, p) => sum + p.valor, 0);
      const valorRestante = Math.max(0, gasto.valor - valorTotalPago);
      
      // Se é fracionado e ainda há valor restante, sugerir o restante
      if (gasto.fracionado && valorRestante > 0) {
        setValorPagoInput(valorRestante.toFixed(2).replace('.', ','));
      } else {
        // Se não é fracionado ou já está completo, sugerir valor total
        setValorPagoInput(gasto.valor.toFixed(2).replace('.', ','));
      }
    } else {
      // Para gastos antigos (compatibilidade)
      const valorPagoAtual = gasto.valorPago || 0;
      const valorRestante = Math.max(0, gasto.valor - valorPagoAtual);
      
      if (valorRestante > 0) {
        setValorPagoInput(valorRestante.toFixed(2).replace('.', ','));
      } else {
        setValorPagoInput(gasto.valor.toFixed(2).replace('.', ','));
      }
    }
    
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setDataPagamento(new Date().toISOString().slice(0, 10));
    setHoraPagamento(new Date().toTimeString().slice(0, 5));
    setIsValorPagoOpen(true);
  };

  // Função para atualizar progresso das compras de cartão
  const atualizarProgressoComprasCartao = async (cardId: string) => {
    try {
      // Encontrar todas as compras deste cartão
      const comprasDoCartao = (comprasCartao as any[]).filter(compra => compra.cardId === cardId);
      
      for (const compra of comprasDoCartao) {
        // Contar parcelas pagas para esta compra
        const parcelasPagas = (gastosFixos as GastoFixo[]).filter(gasto => 
          gasto.id.startsWith(`cartao:${cardId}:${compra.id}:`) && gasto.pago
        ).length;
        
        // Atualizar a compra com o novo progresso
        const compraAtualizada = { ...compra, parcelasPagas };
        await (saveCompraCartao && (saveCompraCartao as any)(compraAtualizada));
      }
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error);
    }
  };

  // Função para reverter pagamento quando transação é excluída
  const reverterPagamentoGastoFixo = async (gastoId: string) => {
    try {
      const gasto = (gastosFixos as GastoFixo[]).find(g => g.id === gastoId);
      if (!gasto) {
        return;
      }

      const gastoAtualizado = { ...gasto, valorPago: 0, pago: false };
      await saveGastoFixo(gastoAtualizado);
      setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === gastoId ? gastoAtualizado : g));
    } catch (error) {
      console.error('Erro ao reverter pagamento:', error);
    }
  };

  const excluirPagamento = async (pagamentoId: string) => {
    if (!editingGasto || !editingGasto.pagamentos) return;
    
    if (!confirm('Tem certeza que deseja excluir este pagamento?')) return;
    
    // Filtrar o pagamento específico
    const pagamentosAtualizados = editingGasto.pagamentos.filter(p => p.id !== pagamentoId);
    const valorTotalPago = pagamentosAtualizados.reduce((sum, p) => sum + p.valor, 0);
    
    // Criar gasto atualizado
    const gastoAtualizado: GastoFixo = {
      ...editingGasto,
      pagamentos: pagamentosAtualizados,
      valorPago: valorTotalPago,
      pago: valorTotalPago >= editingGasto.valor
    };
    
    // Salvar no banco
    await saveGastoFixo(gastoAtualizado);
    
    // Atualizar estado global (seguindo o padrão do projeto)
    setGastosFixos((prev: GastoFixo[]) =>
      prev.map(g => g.id === editingGasto.id ? gastoAtualizado : g)
    );
    
    // Atualizar o estado local do modal
    setEditingGasto(gastoAtualizado);
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
    // NÃO são consolidados: divida:... (são parcelas individuais de dívidas)
    const isGastoConsolidado = (gastoSelecionado.id.startsWith('cartao:') && gastoSelecionado.id.includes(':') && !gastoSelecionado.id.startsWith('divida:')) || 
                              gastoSelecionado.id.startsWith('esporadicos:');
    
    if (isGastoConsolidado) {
      // Para gastos consolidados, atualizar as parcelas individuais e sincronizar com compras de cartão
      
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

      // Sincronizar com compras de cartão se for gasto de cartão
      if (gastoSelecionado.id.startsWith('cartao:')) {
        const parts = gastoSelecionado.id.split(':');
        const cardId = parts[1];
        
        // Encontrar todas as parcelas deste cartão no mês selecionado
        const parcelasDoCartao = (gastosFixos as GastoFixo[]).filter(g => 
          g.id.startsWith(`cartao:${cardId}:`) && g.id.endsWith(selectedMonth)
        );
        
        // Atualizar cada parcela individual
        for (const parcela of parcelasDoCartao) {
          const parcelaAtualizada = { ...parcela, valorPago: parcela.valor, pago: true };
          await saveGastoFixo(parcelaAtualizada);
        }
        
        // Atualizar progresso das compras de cartão
        await atualizarProgressoComprasCartao(cardId);
      }
    } else {
      // Para gastos manuais normais
      let gastoAtualizado: GastoFixo;
      
      // Se já tem array pagamentos (gasto migrado ou novo)
      if (gastoSelecionado.pagamentos) {
        const novoPagamento: Pagamento = {
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${gastoSelecionado.id}-pagamento-${Date.now()}`,
          valor: valorPago,
          data: dataPagamento,
          hora: horaPagamento,
          descricao: 'Pagamento manual'
        };
        
        const pagamentosAtualizados = [...(gastoSelecionado.pagamentos || []), novoPagamento];
        const valorTotalPago = pagamentosAtualizados.reduce((sum, p) => sum + p.valor, 0);
        
        gastoAtualizado = {
          ...gastoSelecionado,
          valorPago: valorTotalPago,
          pagamentos: pagamentosAtualizados,
          pago: valorTotalPago >= gastoSelecionado.valor
        };
      } else {
        // Para gastos antigos (compatibilidade) - migrar para nova estrutura
        const pagamentoExistente: Pagamento = {
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${gastoSelecionado.id}-pagamento-1`,
          valor: valorPago,
          data: dataPagamento,
          hora: horaPagamento,
          descricao: 'Pagamento migrado'
        };
        
        gastoAtualizado = {
          ...gastoSelecionado,
          valorPago,
          pagamentos: [pagamentoExistente],
          fracionado: false,
          pago: valorPago >= gastoSelecionado.valor
        };
      }
      
      await saveGastoFixo(gastoAtualizado);
      setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === gastoSelecionado.id ? gastoAtualizado : g));
      
      // Atualizar saldo do caixa e criar transação automaticamente
      const caixaAtual = caixas?.find(c => c.id === caixaPagamento);
      if (caixaAtual) {
        const novoSaldo = caixaAtual.saldo - valorPago;
        if (novoSaldo < 0) {
          alert('Saldo insuficiente no caixa selecionado. A operação foi bloqueada.');
          return;
        }
        
        // Atualizar saldo do caixa
        await saveCaixa({ ...caixaAtual, saldo: novoSaldo });
        
        // Criar transação automaticamente para o pagamento
        const novaTransacao: Transacao = {
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
          caixaId: caixaPagamento,
          tipo: 'saida',
          valor: valorPago,
          descricao: `Gasto Fixo: ${gastoSelecionado.descricao}`,
          categoria: gastoSelecionado.categoria,
          data: dataPagamento,
          hora: horaPagamento,
        };

        // Salvar transação
        await saveTransacao(novaTransacao);
      }
    }
    
    setIsValorPagoOpen(false);
    setGastoSelecionado(null);
    setValorPagoInput('');
    setDataPagamento('');
    setHoraPagamento('');
  };

  const togglePago = async (id: string) => {
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
        setValorPagamentoInput(Number(totalValor).toFixed(2).replace('.', ','));
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
      setValorPagamentoInput(Number(gasto.valor).toFixed(2).replace('.', ','));
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
    await saveGastoFixo(atualizado);
  };

  const ymToIndex = (year: number, month1to12: number) => year * 12 + (month1to12 - 1);

  const confirmarPagamentoVinculado = async () => {
    if (!gastoSelecionado || !caixaPagamento) return;
    const gasto = gastoSelecionado;
    const valorPagamento = parseFloat(valorPagamentoInput.replace(',', '.')) || 0;
    
    // Se for um gasto consolidado de cartão, marcar todas as parcelas
    if (gasto.id.startsWith('cartao:') && gasto.id.includes(selectedMonth)) {
      const parts = gasto.id.split(':');
      const cardId = parts[1];
      
      // Encontrar todas as parcelas deste cartão no mês selecionado
      const parcelasDoCartao = gastosFixos.filter(g => 
        g.id.startsWith(`cartao:${cardId}:`) && g.id.endsWith(selectedMonth)
      );
      
      // Marcar todas as parcelas como pagas
      for (const parcela of parcelasDoCartao) {
        const parcelaPaga = { ...parcela, pago: true, valorPago: valorPagamento };
        await (saveGastoFixo && saveGastoFixo(parcelaPaga));
        setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === parcela.id ? parcelaPaga : g));
      }
      
      // Sincronizar progresso das compras de cartão
      await atualizarProgressoComprasCartao(cardId);
    } else {
      // Marcar gasto como pago (comportamento normal)
      const gastoPago = { ...gasto, pago: true, valorPago: valorPagamento };
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
          const novoValorPago = d.valorPago + valorPagamento;
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
        const novoSaldo = caixa.saldo - valorPagamento;
        if (novoSaldo < 0) { alert('Saldo insuficiente no caixa selecionado.'); return; }
        await (saveCaixa && (saveCaixa as any)({ ...caixa, saldo: novoSaldo }));
      }
      await (saveTransacao && saveTransacao({
        id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
        caixaId: caixaPagamento,
        tipo: 'saida',
        valor: valorPagamento,
        descricao: `Gasto fixo pago: ${gasto.descricao}`,
        categoria: 'Dívidas',
        data: new Date().toISOString().slice(0,10),
        hora: new Date().toTimeString().slice(0,5)
      }));
    } catch {}

    setIsPagamentoOpen(false);
    setGastoSelecionado(null);
    setValorPagamentoInput('');
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
        const parcelaNaoPaga = { ...parcela, pago: false, valorPago: 0 };
        await (saveGastoFixo && saveGastoFixo(parcelaNaoPaga));
        setGastosFixos((prev: GastoFixo[]) => prev.map(g => g.id === parcela.id ? parcelaNaoPaga : g));
      }
      
      // Sincronizar progresso das compras de cartão
      await atualizarProgressoComprasCartao(cardId);
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
    .reduce((sum, g) => sum + Math.max(0, g.valor - (g.valorPago || 0)), 0);

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
            <div className="space-y-2">
              <Label htmlFor="valorPagamento">Valor do Pagamento</Label>
              <Input
                id="valorPagamento"
                type="text"
                value={valorPagamentoInput}
                onChange={(e) => setValorPagamentoInput(e.target.value)}
                placeholder="0,00"
                required
              />
              <p className="text-sm text-muted-foreground">Valor total: <strong>R$ {gastoSelecionado?.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
            </div>
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
                type="text"
                value={valorPagoInput}
                onChange={(e) => setValorPagoInput(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-sm text-muted-foreground">
                Valor total: R$ {gastoSelecionado?.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
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
            <Button variant="outline" onClick={() => {
              setIsValorPagoOpen(false);
              setDataPagamento('');
              setHoraPagamento('');
            }}>Cancelar</Button>
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
        
        <div className="flex items-center">
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
                    : 'Adicione um novo gasto que se repete mensalmente.'}
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
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="fracionado"
                  checked={isFracionado}
                  onCheckedChange={setIsFracionado}
                />
                <Label htmlFor="fracionado">Permitir múltiplos pagamentos (ex: feira, supermercado)</Label>
              </div>
              
              {/* Histórico de Pagamentos */}
              {editingGasto && editingGasto.pagamentos && editingGasto.pagamentos.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Histórico de Pagamentos</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded p-3">
                      {editingGasto.pagamentos.map((pagamento, index) => (
                        <div key={`pagamento-${pagamento.id}-${index}`} className="flex justify-between items-center text-sm">
                          <div className="flex flex-col flex-1">
                            <span className="font-medium">{pagamento.descricao || `Pagamento ${index + 1}`}</span>
                            <span className="text-muted-foreground text-xs">
                              {pagamento.hora && `${pagamento.hora} em `}
                              {new Date(pagamento.data).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-green-600">
                              R$ {pagamento.valor.toFixed(2).replace('.', ',')}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => excluirPagamento(pagamento.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between items-center font-medium">
                          <span>Total Pago:</span>
                          <span className="text-green-600">
                            R$ {editingGasto.pagamentos.reduce((sum, p) => sum + p.valor, 0).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : editingGasto ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
          {/* Botão de limpeza removido a pedido do usuário */}
        </div>
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
              {gastosComDataAjustada.filter(g => (g.valor - (g.valorPago || 0)) > 0).length} gasto(s) pendente(s)
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

      {/* Lista de gastos fixos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Gastos Fixos</CardTitle>
          <CardDescription>
            {gastosComDataAjustada.length} gasto(s) cadastrado(s)
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
                    <p className="text-sm text-muted-foreground">
                      Pago: R$ {(gasto.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  <TableHead className="text-right">Valor Pago</TableHead>
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
                    <TableCell className="text-right font-medium">
                      R$ {(gasto.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

      {/* Gastos por Categoria */}
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
    </div>
  );
}
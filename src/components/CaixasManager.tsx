import React, { useContext, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Trash2, Plus, Edit, Wallet, PiggyBank, CreditCard, TrendingUp, Target, Percent, DollarSign, CheckCircle, Circle, Calendar } from 'lucide-react';
import { FinanceiroContext, Caixa, Cofrinho, ReceitaPrevista } from '../App';

const tiposIcon = {
  conta_corrente: Wallet,
  poupanca: PiggyBank,
  carteira: Wallet,
  investimento: TrendingUp,
};

const tiposLabel = {
  conta_corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  carteira: 'Carteira',
  investimento: 'Investimento',
};

export default function CaixasManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { 
    caixas, 
    setCaixas, 
    cofrinhos, 
    setCofrinhos, 
    receitasPrevistas, 
    setReceitasPrevistas, 
    saveReceitaPrevista, 
    deleteReceitaPrevista,
    saveCaixa,
    deleteCaixa,
    saveCofrinho,
    deleteCofrinho,
    setSelectedCaixaId,
    goToTab,
    transacoes,
    saveTransacao,
  } = context;

  // Mês selecionado para exibição
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmittingCaixa, setIsSubmittingCaixa] = useState(false);
  const [isCofrinhoDialogOpen, setIsCofrinhoDialogOpen] = useState(false);
  const [isSubmittingCofrinho, setIsSubmittingCofrinho] = useState(false);
  const [isReceitaDialogOpen, setIsReceitaDialogOpen] = useState(false);
  const [isSubmittingReceita, setIsSubmittingReceita] = useState(false);
  const [editingCaixa, setEditingCaixa] = useState<Caixa | null>(null);
  const [editingCofrinho, setEditingCofrinho] = useState<Cofrinho | null>(null);
  const [editingReceita, setEditingReceita] = useState<ReceitaPrevista | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    saldo: '',
    tipo: 'conta_corrente' as Caixa['tipo'],
  });
  const [cofrinhoFormData, setCofrinhoFormData] = useState({
    nome: '',
    tipo: 'cdi' as 'cdi' | 'manual',
    valorAplicado: '',
    dataAplicacao: new Date().toISOString().slice(0,10),
    percentualCDI: '',
    cor: '#10b981',
  });
  const [receitaFormData, setReceitaFormData] = useState({
    descricao: '',
    valor: '',
    dataVencimento: '',
  });

  // Formatter consistente para 2 casas decimais em pt-BR
  const formatBR2 = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Helpers: CDI/IOF/IR
  const CDI_ANUAL_PERCENT = 10.75; // fixo conforme solicitado
  const dailyRateFromAnnual = (annualPercent: number) => Math.pow(1 + annualPercent / 100, 1 / 252) - 1;
  // Helpers de mês (YYYY-MM) para cálculo de saldo mensal por caixa
  const ymToIndex = (y: number, m: number) => y * 12 + (m - 1);
  const parseYM = (ym: string) => {
    const [yy, mm] = ym.split('-').map(Number);
    return { y: yy, m: mm };
  };
  const nextYM = (y: number, m: number) => {
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    return { y: ny, m: nm };
  };
  const formatYM = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

  const monthlyTotalFor = (caixaId: string, y: number, m: number) => {
    return transacoes
      .filter(t => t.caixaId === caixaId)
      .filter(t => {
        const d = new Date(t.data + 'T00:00:00');
        return d.getFullYear() === y && d.getMonth() === (m - 1);
      })
      .reduce((s, t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
  };

  // Calcula valor inicial efetivo do mês: usa initialByMonth[mes] se existir, senão carrega do último mês conhecido somando os lançamentos mês a mês
  const computeInitialForMonth = (caixa: Caixa, ym: string) => {
    const init = (caixa as any).initialByMonth as Record<string, number> | undefined;
    if (init && Object.prototype.hasOwnProperty.call(init, ym)) {
      return (init as any)[ym] ?? 0;
    }
    const { y: ty, m: tm } = parseYM(ym);
    // Encontrar último mês com inicial definido anterior ao target
    let bestKey: string | null = null;
    if (init) {
      Object.keys(init).forEach(k => {
        const { y, m } = parseYM(k);
        if (ymToIndex(y, m) <= ymToIndex(ty, tm)) {
          if (bestKey === null) {
            bestKey = k;
          } else {
            const { y: by, m: bm } = parseYM(bestKey);
            if (ymToIndex(y, m) > ymToIndex(by, bm)) bestKey = k;
          }
        }
      });
    }
    if (!bestKey) return 0;
    const { y: sy, m: sm } = parseYM(bestKey);
    let currentInitial = (init as any)[bestKey] ?? 0;
    // Propagar até o mês alvo
    let cy = sy, cm = sm;
    while (!(cy === ty && cm === tm)) {
      const total = monthlyTotalFor(caixa.id, cy, cm);
      const n = nextYM(cy, cm);
      currentInitial = currentInitial + total;
      cy = n.y; cm = n.m;
    }
    return currentInitial;
  };
  const approxBusinessDays = (from: string, to: string) => {
    const d1 = new Date(from + 'T00:00:00');
    const d2 = new Date(to + 'T00:00:00');
    const diffDays = Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / 86400000));
    return Math.max(0, Math.round(diffDays * (252 / 365)));
  };
  const iofRateForDays = (daysSince: number) => {
    if (daysSince >= 30) return 0;
    const remain = 30 - daysSince; // 30..1
    return Math.max(0, remain / 30);
  };
  const irRateForDays = (daysSince: number) => {
    if (daysSince <= 180) return 0.225;
    if (daysSince <= 360) return 0.20;
    if (daysSince <= 720) return 0.175;
    return 0.15;
  };
  const todayStr = new Date().toISOString().slice(0,10);
  const computeCdiRendimento = (cofrinho: Cofrinho) => {
    if (!cofrinho || (cofrinho.tipo !== 'cdi')) return { saldoLiquido: cofrinho?.saldo || 0, rendimentoLiquido: 0, rendimentoBruto: 0, totalIR: 0, totalIOF: 0, principal: (cofrinho?.valorAplicado || 0) + (cofrinho?.aportes?.reduce((s,a)=>s+a.valor,0) || 0) };
    const percentOfCDI = cofrinho.percentualCDI || 0;
    const baseDaily = dailyRateFromAnnual(CDI_ANUAL_PERCENT);
    const daily = baseDaily * (percentOfCDI / 100);
    const aportes = [
      ...(cofrinho.valorAplicado && cofrinho.dataAplicacao ? [{ data: cofrinho.dataAplicacao, valor: cofrinho.valorAplicado }] : []),
      ...(cofrinho.aportes || [])
    ];
    const principal = aportes.reduce((s,a)=>s + a.valor, 0);
    let rendimentoBruto = 0;
    let totalIR = 0;
    let totalIOF = 0;
    for (const ap of aportes) {
      const nBiz = approxBusinessDays(ap.data, todayStr);
      const fator = Math.pow(1 + daily, nBiz);
      const rendBrutoAp = ap.valor * (fator - 1);
      const daysSince = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(ap.data).getTime())/86400000));
      const iof = iofRateForDays(daysSince) * rendBrutoAp;
      const baseIr = rendBrutoAp - iof;
      const ir = Math.max(0, baseIr) * irRateForDays(daysSince);
      rendimentoBruto += rendBrutoAp;
      totalIOF += iof;
      totalIR += ir;
    }
    const rendimentoLiquido = Math.max(0, rendimentoBruto - totalIOF - totalIR);
    const saldoLiquido = principal + rendimentoLiquido;
    return { saldoLiquido, rendimentoLiquido, rendimentoBruto, totalIR, totalIOF, principal };
  };

  const elapsedLabel = (cofrinho: Cofrinho) => {
    const baseDate = (cofrinho.tipo === 'cdi' ? (cofrinho.dataAplicacao || cofrinho.dataCriacao) : cofrinho.dataCriacao) || todayStr;
    const ms = new Date(todayStr).getTime() - new Date(baseDate + 'T00:00:00').getTime();
    const days = Math.max(0, Math.floor(ms / 86400000));
    if (days < 30) return `${days} ${days === 1 ? 'dia' : 'dias'}`;
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  };

  // Modal de Aporte
  const [isAporteOpen, setIsAporteOpen] = useState(false);
  const [cofrinhoAporte, setCofrinhoAporte] = useState<Cofrinho | null>(null);
  const [aporteData, setAporteData] = useState(new Date().toISOString().slice(0,10));
  const [aporteValor, setAporteValor] = useState('');
  const abrirAporte = (c: Cofrinho) => {
    setCofrinhoAporte(c);
    setAporteData(new Date().toISOString().slice(0,10));
    setAporteValor('');
    setIsAporteOpen(true);
  };
  const confirmarAporte = async () => {
    if (!cofrinhoAporte) return;
    const valor = parseFloat(aporteValor);
    if (!aporteData || isNaN(valor) || valor <= 0) return;
    const atualizado: Cofrinho = {
      ...cofrinhoAporte,
      valorAplicado: (cofrinhoAporte.valorAplicado || 0) + valor,
      saldo: (cofrinhoAporte.saldo || 0) + valor,
      aportes: [...(cofrinhoAporte.aportes || []), { data: aporteData, valor }],
    };
    await saveCofrinho(atualizado);
    setCofrinhos(prev => prev.map(c => c.id === atualizado.id ? atualizado : c));
    setIsAporteOpen(false);
    setCofrinhoAporte(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCaixa) return;
    
    if (!formData.nome || !formData.saldo) return;
    setIsSubmittingCaixa(true);

    // Novo comportamento: editar o valor define o valor inicial do mês selecionado
    const valorInicialMes = parseFloat(formData.saldo.replace(',', '.'));
    const caixaId = editingCaixa?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString());
    const caixaExistente = editingCaixa || { id: caixaId, nome: formData.nome, saldo: 0, tipo: formData.tipo } as Caixa;
    const initialByMonth = { ...(caixaExistente.initialByMonth || {}) } as Record<string, number>;
    initialByMonth[selectedMonth] = valorInicialMes;

    const caixaAtualizada: Caixa = {
      ...caixaExistente,
      id: caixaId,
      nome: formData.nome,
      tipo: formData.tipo,
      // Mantemos saldo legado inalterado; exibição mensal usa initialByMonth + extrato
      saldo: caixaExistente.saldo ?? 0,
      initialByMonth,
    };

    await saveCaixa(caixaAtualizada);
    // Atualização otimista
    setCaixas(prev => {
      const index = prev.findIndex(c => c.id === caixaAtualizada.id);
      if (index >= 0) {
        const clone = [...prev];
        clone[index] = caixaAtualizada;
        return clone;
      }
      return [...prev, caixaAtualizada];
    });

    resetForm();
    setIsSubmittingCaixa(false);
  };

  const resetForm = () => {
    setFormData({ nome: '', saldo: '', tipo: 'conta_corrente' });
    setEditingCaixa(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (caixa: Caixa) => {
    setEditingCaixa(caixa);
    // Pré-carregar com valor inicial do mês selecionado (ou 0 se ausente)
    const initialByMonth = caixa.initialByMonth || {};
    const saldoInicialMes = (initialByMonth as any)[selectedMonth] ?? '';
    setFormData({
      nome: caixa.nome,
      saldo: saldoInicialMes === '' ? '' : String(saldoInicialMes),
      tipo: caixa.tipo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta caixa?')) return;
    await deleteCaixa(id);
    // Atualização otimista da UI
      setCaixas(prev => prev.filter(c => c.id !== id));
  };

  // Funções para cofrinhos
  const handleCofrinhoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCofrinho) return;
    
    if (!cofrinhoFormData.nome) return;
    if (cofrinhoFormData.tipo === 'cdi') {
      if (!cofrinhoFormData.valorAplicado || !cofrinhoFormData.dataAplicacao || !cofrinhoFormData.percentualCDI) return;
    } else {
      if (!cofrinhoFormData.valorAplicado) return;
    }

    const novoCofrinho: Cofrinho = {
      id: editingCofrinho?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString()),
      nome: cofrinhoFormData.nome,
      saldo: parseFloat(cofrinhoFormData.valorAplicado),
      tipo: cofrinhoFormData.tipo,
      dataAplicacao: cofrinhoFormData.dataAplicacao,
      valorAplicado: parseFloat(cofrinhoFormData.valorAplicado),
      aportes: [],
      percentualCDI: cofrinhoFormData.tipo === 'cdi' ? parseFloat(cofrinhoFormData.percentualCDI) : undefined,
      rendimentoMensal: 0,
      dataCriacao: editingCofrinho?.dataCriacao || new Date().toISOString().split('T')[0],
      cor: cofrinhoFormData.cor,
    };

    setIsSubmittingCofrinho(true);
    await saveCofrinho(novoCofrinho);
    setCofrinhos(prev => {
      const index = prev.findIndex(c => c.id === novoCofrinho.id);
      if (index >= 0) {
        const clone = [...prev];
        clone[index] = novoCofrinho;
        return clone;
      }
      return [...prev, novoCofrinho];
    });

    resetCofrinhoForm();
    setIsSubmittingCofrinho(false);
  };

  const resetCofrinhoForm = () => {
    setCofrinhoFormData({ nome: '', tipo: 'cdi', valorAplicado: '', dataAplicacao: new Date().toISOString().slice(0,10), percentualCDI: '', cor: '#10b981' });
    setEditingCofrinho(null);
    setIsCofrinhoDialogOpen(false);
  };

  const handleEditCofrinho = (cofrinho: Cofrinho) => {
    setEditingCofrinho(cofrinho);
    setCofrinhoFormData({
      nome: cofrinho.nome,
      tipo: cofrinho.tipo || 'cdi',
      valorAplicado: (cofrinho.valorAplicado ?? cofrinho.saldo).toString(),
      dataAplicacao: cofrinho.dataAplicacao || new Date().toISOString().slice(0,10),
      percentualCDI: (cofrinho.percentualCDI ?? '').toString(),
      cor: cofrinho.cor,
    });
    setIsCofrinhoDialogOpen(true);
  };

  const handleDeleteCofrinho = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cofrinho?')) return;
    await deleteCofrinho(id);
      setCofrinhos(prev => prev.filter(c => c.id !== id));
  };

  // Funções para receitas previstas
  const handleReceitaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingReceita) return;
    
    if (!receitaFormData.descricao || !receitaFormData.valor || !receitaFormData.dataVencimento) return;

    const novaReceita: ReceitaPrevista = {
      id: editingReceita?.id || Date.now().toString(),
      descricao: receitaFormData.descricao,
      valor: parseFloat(receitaFormData.valor),
      recebido: editingReceita?.recebido || false,
      dataVencimento: receitaFormData.dataVencimento,
    };

    setIsSubmittingReceita(true);
    await saveReceitaPrevista(novaReceita);
    resetReceitaForm();
    setIsSubmittingReceita(false);
  };

  const resetReceitaForm = () => {
    setReceitaFormData({ descricao: '', valor: '', dataVencimento: '' });
    setEditingReceita(null);
    setIsReceitaDialogOpen(false);
  };

  const handleEditReceita = (receita: ReceitaPrevista) => {
    setEditingReceita(receita);
    setReceitaFormData({
      descricao: receita.descricao,
      valor: receita.valor.toString(),
      dataVencimento: receita.dataVencimento,
    });
    setIsReceitaDialogOpen(true);
  };

  const handleDeleteReceita = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta receita prevista?')) {
      await deleteReceitaPrevista(id);
    }
  };

  const [isReceitaPagamentoOpen, setIsReceitaPagamentoOpen] = useState(false);
  const [receitaSelecionada, setReceitaSelecionada] = useState<ReceitaPrevista | null>(null);
  const [caixaReceita, setCaixaReceita] = useState<string | null>(null);

  const toggleReceitaRecebida = async (receita: ReceitaPrevista) => {
    if (!receita.recebido) {
      // Se está marcando como recebida, abrir modal para selecionar caixa
      setReceitaSelecionada(receita);
      setCaixaReceita(caixas && caixas.length > 0 ? caixas[0].id : null);
      setIsReceitaPagamentoOpen(true);
    } else {
      // Não permitir desmarcar diretamente - deve excluir a transação
      alert('Para desmarcar esta receita, exclua a transação de entrada correspondente na aba Transações.');
    }
  };

  const confirmarReceitaPagamento = async () => {
    if (!receitaSelecionada || !caixaReceita) return;

    const caixaSelecionado = caixas.find(c => c.id === caixaReceita);
    if (!caixaSelecionado) return;

    // Atualizar saldo do caixa
    const novoSaldo = caixaSelecionado.saldo + receitaSelecionada.valor;
    await saveCaixa({ ...caixaSelecionado, saldo: novoSaldo });

    // Criar transação de entrada
    await saveTransacao({
      id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
      caixaId: caixaReceita,
      tipo: 'entrada',
      valor: receitaSelecionada.valor,
      descricao: `Receita recebida: ${receitaSelecionada.descricao}`,
      categoria: 'Receitas',
      data: new Date().toISOString().slice(0,10),
      hora: new Date().toTimeString().slice(0,5)
    });

    // Marcar receita como recebida e guardar o caixaId
    const receitaAtualizada = { ...receitaSelecionada, recebido: true, caixaId: caixaReceita };
    await saveReceitaPrevista(receitaAtualizada);

    // Fechar modal e limpar estados
    setIsReceitaPagamentoOpen(false);
    setReceitaSelecionada(null);
    setCaixaReceita(null);
  };

  // Função para verificar e reverter receitas sem transação correspondente
  const verificarEReverterReceitas = () => {
    if (!transacoes || !Array.isArray(transacoes) || !receitasPrevistas || !Array.isArray(receitasPrevistas)) {
      return;
    }
    
    const transacoesReceitas = (transacoes as any[]).filter(t => 
      t.descricao && t.descricao.includes('Receita recebida:')
    );
    
    // Para cada receita marcada como recebida, verificar se tem transação correspondente
    (receitasPrevistas as ReceitaPrevista[]).forEach(receita => {
      if (receita.recebido) {
        const descricaoEsperada = `Receita recebida: ${receita.descricao}`;
        const temTransacao = transacoesReceitas.some(t => t.descricao === descricaoEsperada);
        
        if (!temTransacao) {
          reverterRecebimentoReceita(receita.id);
        }
      }
    });
  };

  // Função para reverter recebimento de receita
  const reverterRecebimentoReceita = async (receitaId: string) => {
    try {
      const receita = (receitasPrevistas as ReceitaPrevista[]).find(r => r.id === receitaId);
      if (!receita) return;

      // Criar objeto sem o campo caixaId (remover ao invés de undefined)
      const { caixaId, ...receitaSemCaixa } = receita;
      const receitaAtualizada: ReceitaPrevista = {
        ...receitaSemCaixa,
        recebido: false,
      };
      
      await saveReceitaPrevista(receitaAtualizada);
    } catch (error) {
      console.error('Erro ao reverter recebimento:', error);
    }
  };

  // Monitora mudanças nas transações para verificar consistência
  useEffect(() => {
    // Aguardar as operações de gravação para evitar falso positivo
    const timeoutId = setTimeout(() => {
      verificarEReverterReceitas();
    }, 1200);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [transacoes, receitasPrevistas]); // Executa quando transacoes ou receitasPrevistas mudam

  // Mês/ano selecionados (usar antes dos cálculos)
  const [anoSelecionado, mesSelecionado] = selectedMonth.split('-').map(Number);

  // Total Geral: soma do saldo final do mês de cada caixa + saldo líquido/atual de cada cofrinho
  const totalCaixasMes = caixas.reduce((sum, caixa) => {
    const valorInicial = computeInitialForMonth(caixa, selectedMonth);
    const totalMes = monthlyTotalFor(caixa.id, anoSelecionado, mesSelecionado);
    return sum + (valorInicial + totalMes);
  }, 0);
  const totalCofrinhos = cofrinhos.reduce((sum, cofrinho) => {
    const valor = cofrinho.tipo === 'cdi' ? computeCdiRendimento(cofrinho).saldoLiquido : (cofrinho.saldo || 0);
    return sum + valor;
  }, 0);
  const totalGeral = totalCaixasMes + totalCofrinhos;
  
  // Receitas previstas são recorrentes (como gastos fixos) - sempre mostram todas
  // Mas as datas de vencimento são ajustadas para o mês selecionado
  
  // Mapear descrições de receitas já recebidas no mês selecionado (derivado das transações)
  const descricoesRecebidasNoMes = new Set(
    (transacoes as any[] || [])
      .filter(t => {
        const d = new Date(t.data + 'T00:00:00');
        return d.getFullYear() === anoSelecionado && d.getMonth() === (mesSelecionado - 1);
      })
      .map(t => t.descricao)
      .filter((desc: string) => typeof desc === 'string' && desc.startsWith('Receita recebida: '))
      .map((desc: string) => desc.replace('Receita recebida: ', ''))
  );

  const receitasComDataAjustada = receitasPrevistas.map(receita => {
    // Validar se dataVencimento existe e é válida
    if (!receita.dataVencimento) {
      return {
        ...receita,
        dataVencimentoAjustada: receita.dataVencimento
      };
    }
    
    const dataOriginal = new Date(receita.dataVencimento);
    const diaVencimento = dataOriginal.getDate();
    
    // Validar se a data é válida
    if (isNaN(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
      return {
        ...receita,
        dataVencimentoAjustada: receita.dataVencimento
      };
    }
    
    // Criar nova data com o dia original mas mês/ano selecionado
    const novaData = new Date(anoSelecionado, mesSelecionado - 1, diaVencimento);
    
    // Validar se a nova data é válida
    if (isNaN(novaData.getTime())) {
      return {
        ...receita,
        dataVencimentoAjustada: receita.dataVencimento
      };
    }
    
    return {
      ...receita,
      dataVencimentoAjustada: novaData.toISOString().split('T')[0],
      // Recebido no mês é derivado das transações do mês
      recebidoNoMes: descricoesRecebidasNoMes.has(receita.descricao)
    } as any;
  });
  
  const totalReceitasPrevistas = receitasPrevistas.reduce((sum, receita) => sum + receita.valor, 0);
  const totalReceitasRecebidas = receitasComDataAjustada.filter((r: any) => r.recebidoNoMes).reduce((sum: number, receita: any) => sum + receita.valor, 0);
  const totalReceitasAReceber = Math.max(0, totalReceitasPrevistas - totalReceitasRecebidas);

  return (
    <div className="space-y-6">
      {/* Dialog de caixa (compartilhado) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="hidden">
              <Plus className="h-4 w-4 mr-2" />
              Nova Caixa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCaixa ? 'Editar Caixa' : 'Nova Caixa'}
              </DialogTitle>
              <DialogDescription>
                {editingCaixa 
                  ? 'Edite as informações da caixa selecionada.'
                  : 'Adicione uma nova caixa para organizar seus recursos financeiros.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Caixa</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Conta Corrente, Carteira, etc."
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="saldo">Valor inicial do mês ({selectedMonth})</Label>
                <Input
                  id="saldo"
                  type="number"
                  step="0.01"
                  value={formData.saldo}
                  onChange={(e) => setFormData(prev => ({ ...prev, saldo: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(value: Caixa['tipo']) => setFormData(prev => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conta_corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="carteira">Carteira</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmittingCaixa}>
                  {isSubmittingCaixa ? 'Salvando...' : (editingCaixa ? 'Salvar' : 'Criar')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* Cabeçalho compacto */}
      <div className="flex flex-col gap-3 pb-2 border-b">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Gestão de Caixas</h2>
              <p className="text-sm text-muted-foreground">Gerencie suas contas, carteiras e investimentos</p>
            </div>
          </div>
          
          {/* Controles - Desktop/Tablet */}
          <div className="hidden md:flex items-center gap-2">
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Caixa
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
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Caixa
          </Button>
          <Input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            className="w-[160px]" 
          />
        </div>
      </div>

      {/* Card com total geral */}
      <Card>
        <CardHeader>
          <CardTitle>Total Geral</CardTitle>
          <CardDescription>Saldo final dos caixas no mês + cofrinhos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            R$ {formatBR2.format(totalGeral)}
          </div>
        </CardContent>
      </Card>

      {/* Lista de caixas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {caixas.map((caixa) => {
          const IconComponent = tiposIcon[caixa.tipo];
          // Cálculo do saldo final do mês selecionado: valor inicial do mês + soma de lançamentos do mês
          const valorInicial = computeInitialForMonth(caixa, selectedMonth);
          const [ano, mes] = selectedMonth.split('-').map(Number);
          const totalMes = monthlyTotalFor(caixa.id, ano, mes);
          const saldoFinalMes = valorInicial + totalMes;
          
          return (
            <Card key={caixa.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{caixa.nome}</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {tiposLabel[caixa.tipo]}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo inicial ({selectedMonth})</p>
                    <p className="text-lg font-medium">R$ {formatBR2.format(valorInicial)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lançamentos do mês</p>
                    <p className={`text-lg font-medium ${totalMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalMes >= 0 ? '+' : ''}R$ {formatBR2.format(Math.abs(totalMes))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo final ({selectedMonth})</p>
                    <p className={`text-2xl font-bold ${saldoFinalMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {formatBR2.format(saldoFinalMes)}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(caixa)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 md:mr-1" />
                      <span className="hidden md:inline">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSelectedCaixaId(caixa.id); goToTab('transacoes'); }}
                      className="flex-1"
                    >
                      Extrato
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(caixa.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {caixas.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma caixa cadastrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando sua primeira caixa para organizar seus recursos financeiros.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira caixa
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />

      {/* Seção de Receitas Previstas (movida para baixo dos caixas) */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Receitas Previstas
              </CardTitle>
              <CardDescription>Gerencie seus recebimentos mensais</CardDescription>
            </div>
            <Dialog open={isReceitaDialogOpen} onOpenChange={setIsReceitaDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetReceitaForm()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Receita
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingReceita ? 'Editar Receita' : 'Nova Receita Prevista'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingReceita 
                      ? 'Edite as informações da receita selecionada.'
                      : 'Adicione uma nova receita prevista para controle de recebimentos.'}
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleReceitaSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="descricao-receita">Descrição</Label>
                    <Input
                      id="descricao-receita"
                      value={receitaFormData.descricao}
                      onChange={(e) => setReceitaFormData(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Ex: Salário Principal, Freelance, etc."
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valor-receita">Valor</Label>
                      <Input
                        id="valor-receita"
                        type="number"
                        step="0.01"
                        value={receitaFormData.valor}
                        onChange={(e) => setReceitaFormData(prev => ({ ...prev, valor: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="data-vencimento">Data de Vencimento</Label>
                      <Input
                        id="data-vencimento"
                        type="date"
                        value={receitaFormData.dataVencimento}
                        onChange={(e) => setReceitaFormData(prev => ({ ...prev, dataVencimento: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetReceitaForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmittingReceita}>
                      {isSubmittingReceita ? 'Salvando...' : (editingReceita ? 'Salvar' : 'Criar')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Previsto</p>
              <p className="text-xl font-bold text-blue-600">
                R$ {totalReceitasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <p className="text-xl font-bold text-green-600">
                R$ {totalReceitasRecebidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-muted-foreground">A Receber</p>
              <p className="text-xl font-bold text-orange-600">
                R$ {totalReceitasAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {receitasComDataAjustada.map((receita) => (
              <div key={receita.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                {/* Linha 1: Status + Descrição + Valor */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() => toggleReceitaRecebida(receita)}
                      className={`flex-shrink-0 ${((receita as any).recebidoNoMes) 
                        ? 'text-green-600 hover:text-green-700' 
                        : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {((receita as any).recebidoNoMes) ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                    <p className={`font-medium truncate ${(receita as any).recebidoNoMes ? 'text-muted-foreground' : ''}`}>
                      {receita.descricao}
                    </p>
                  </div>
                  <span className={`font-bold flex-shrink-0 ${(receita as any).recebidoNoMes ? 'text-green-600' : 'text-blue-600'}`}>
                    R$ {receita.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Linha 2: Data + Ações */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Vencimento: {new Date(receita.dataVencimentoAjustada).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditReceita(receita)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteReceita(receita.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {receitasComDataAjustada.length === 0 && (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma receita cadastrada</h3>
                <p className="text-muted-foreground mb-4">
                  Comece adicionando suas receitas previstas para um melhor controle financeiro.
                </p>
                <Button onClick={() => setIsReceitaDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar primeira receita
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de caixas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {caixas.map((caixa) => {
          const IconComponent = tiposIcon[caixa.tipo];
          // Cálculo do saldo final do mês selecionado: valor inicial do mês + soma de lançamentos do mês
          const valorInicial = computeInitialForMonth(caixa, selectedMonth);
          const [ano, mes] = selectedMonth.split('-').map(Number);
          const totalMes = monthlyTotalFor(caixa.id, ano, mes);
          const saldoFinalMes = valorInicial + totalMes;
          
          return (
            <Card key={caixa.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{caixa.nome}</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {tiposLabel[caixa.tipo]}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo inicial ({selectedMonth})</p>
                    <p className="text-lg font-medium">R$ {formatBR2.format(valorInicial)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lançamentos do mês</p>
                    <p className={`text-lg font-medium ${totalMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalMes >= 0 ? '+' : ''}R$ {formatBR2.format(Math.abs(totalMes))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo final ({selectedMonth})</p>
                    <p className={`text-2xl font-bold ${saldoFinalMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {formatBR2.format(saldoFinalMes)}
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(caixa)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 md:mr-1" />
                      <span className="hidden md:inline">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSelectedCaixaId(caixa.id); goToTab('transacoes'); }}
                      className="flex-1"
                    >
                      Extrato
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(caixa.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {caixas.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma caixa cadastrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando sua primeira caixa para organizar seus recursos financeiros.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira caixa
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />

      {/* Seção de Cofrinhos */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Cofrinhos</h2>
            <p className="text-muted-foreground">
              Seus investimentos com rendimento automático (não somados ao total geral)
            </p>
          </div>
          
          <Dialog open={isCofrinhoDialogOpen} onOpenChange={setIsCofrinhoDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetCofrinhoForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cofrinho
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCofrinho ? 'Editar Cofrinho' : 'Novo Cofrinho'}
                </DialogTitle>
                <DialogDescription>
                  {editingCofrinho 
                    ? 'Edite as informações do cofrinho selecionado.'
                    : 'Crie um novo cofrinho com rendimento automático baseado no CDI.'
                  }
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCofrinhoSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome-cofrinho">Nome do Cofrinho</Label>
                  <Input
                    id="nome-cofrinho"
                    value={cofrinhoFormData.nome}
                    onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Emergência, Viagem, Casa..."
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={cofrinhoFormData.tipo} onValueChange={(v) => setCofrinhoFormData(prev => ({ ...prev, tipo: v as any }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cdi">CDI</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data-aplicacao">Data de aplicação</Label>
                    <Input
                      id="data-aplicacao"
                      type="date"
                      value={cofrinhoFormData.dataAplicacao}
                      onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, dataAplicacao: e.target.value }))}
                      disabled={cofrinhoFormData.tipo !== 'cdi'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor-aplicado">Valor aplicado</Label>
                    <Input
                      id="valor-aplicado"
                      type="number"
                      step="0.01"
                      value={cofrinhoFormData.valorAplicado}
                      onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, valorAplicado: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cofrinhoFormData.tipo === 'cdi' && (
                  <div className="space-y-2">
                    <Label htmlFor="percentual-cdi">% do CDI</Label>
                    <Input
                      id="percentual-cdi"
                      type="number"
                      min="0"
                      max="200"
                      value={cofrinhoFormData.percentualCDI}
                      onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, percentualCDI: e.target.value }))}
                      placeholder="Ex: 100 (100% do CDI)"
                      required
                    />
                  </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="cor">Cor</Label>
                    <Input
                      id="cor"
                      type="color"
                      value={cofrinhoFormData.cor}
                      onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, cor: e.target.value }))}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetCofrinhoForm}>
                    Cancelar
                  </Button>
                <Button type="submit" disabled={isSubmittingCofrinho}>
                  {isSubmittingCofrinho ? 'Salvando...' : (editingCofrinho ? 'Salvar' : 'Criar')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de cofrinhos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {cofrinhos.map((cofrinho) => {
            const cdiCalc = computeCdiRendimento(cofrinho);
            const mostrarIOF = cofrinho.tipo === 'cdi' && (() => {
              const base = cofrinho.dataAplicacao || new Date().toISOString().slice(0,10);
              const days = Math.max(0, Math.floor((new Date().getTime() - new Date(base + 'T00:00:00').getTime())/86400000));
              return days < 30;
            })();
            return (
              <Card key={cofrinho.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: cofrinho.cor }}
                      />
                      <CardTitle className="text-lg">{cofrinho.nome}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {elapsedLabel(cofrinho)}
                      </Badge>
                      {cofrinho.tipo === 'cdi' && (
                    <Badge variant="outline" className="flex items-center">
                      <Percent className="h-3 w-3 mr-1" />
                      {cofrinho.percentualCDI}% CDI
                    </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo Líquido Atual</p>
                      <p className="text-2xl font-bold text-green-600">
                        R$ {formatBR2.format(Number(cofrinho.tipo === 'cdi' ? cdiCalc.saldoLiquido : cofrinho.saldo))}
                      </p>
                    </div>
                    
                    {cofrinho.tipo === 'cdi' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Rendimento líquido</span>
                          <span className="font-medium text-green-600">+R$ {cdiCalc.rendimentoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Rentabilidade</span>
                          <div className="text-right">
                            <div className="font-medium">{cdiCalc.principal > 0 ? ((cdiCalc.rendimentoLiquido / cdiCalc.principal) * 100).toFixed(2) : '0.00'}%</div>
                            <div className="text-xs text-muted-foreground">IR: R$ {cdiCalc.totalIR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        </div>
                        {mostrarIOF && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>IOF (até D+30)</span>
                            <span>R$ {cdiCalc.totalIOF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCofrinho(cofrinho)}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 md:mr-1" />
                        <span className="hidden md:inline">Editar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirAporte(cofrinho)}
                        className="flex-1"
                      >
                        <DollarSign className="h-4 w-4 md:mr-1" />
                        <span className="hidden md:inline">Aporte</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCofrinho(cofrinho.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {cofrinhos.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <PiggyBank className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum cofrinho cadastrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie cofrinhos para organizar seus investimentos com rendimento automático.
              </p>
              <Button onClick={() => setIsCofrinhoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro cofrinho
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de seleção de caixa para receita */}
      <Dialog open={isReceitaPagamentoOpen} onOpenChange={setIsReceitaPagamentoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receber receita</DialogTitle>
            <DialogDescription>
              Selecione o caixa onde a receita será creditada: {receitaSelecionada?.descricao}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {caixas && caixas.length > 0 && (
              <div className="space-y-2">
                <Label>Selecionar Caixa</Label>
                <select 
                  className="w-full border rounded h-9 px-2 bg-background" 
                  value={caixaReceita || ''} 
                  onChange={(e) => setCaixaReceita(e.target.value)}
                >
                  <option value="" disabled>Selecione um caixa</option>
                  {caixas.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} - Saldo: R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {receitaSelecionada && (
              <div className="text-sm text-muted-foreground">
                Valor: R$ {receitaSelecionada.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceitaPagamentoOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmarReceitaPagamento}
              disabled={!caixaReceita}
            >
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

  {/* Modal de Aporte */}
  <Dialog open={isAporteOpen} onOpenChange={setIsAporteOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo aporte</DialogTitle>
        <DialogDescription>
          {cofrinhoAporte ? `Adicionar aporte em ${cofrinhoAporte.nome}` : ''}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={aporteData} onChange={(e) => setAporteData(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Valor</Label>
          <Input type="number" step="0.01" value={aporteValor} onChange={(e) => setAporteValor(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setIsAporteOpen(false)}>Cancelar</Button>
        <Button onClick={confirmarAporte} disabled={!aporteData || !aporteValor}>Confirmar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
    </div>
  );
}
import React, { useContext, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Progress } from './ui/progress';
import { Trash2, Plus, Edit, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import { FinanceiroContext, Divida, GastoFixo } from '../App';

export default function DividasManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { dividas, setDividas, saveDivida, deleteDivida, caixas, saveTransacao, gastosFixos, setGastosFixos, saveGastoFixo } = context as any;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDivida, setEditingDivida] = useState<Divida | null>(null);
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);
  const [dividaSelecionada, setDividaSelecionada] = useState<Divida | null>(null);
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
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descricao || !formData.valorTotal || !formData.dataVencimento) return;

    // Ajusta parcela automaticamente se for parcelada e não informada
    let valorParcelaNum = formData.tipo === 'parcelada'
      ? (formData.valorParcela ? parseFloat(formData.valorParcela) : parseFloat(recomputeParcela(formData.valorTotal, formData.parcelas) || '0'))
      : parseFloat(formData.valorTotal);

    const novaDivida: Divida = {
      id: editingDivida?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString()),
      descricao: formData.descricao,
      valorTotal: parseFloat(formData.valorTotal),
      valorPago: editingDivida?.valorPago || 0,
      parcelas: formData.tipo === 'parcelada' ? parseInt(formData.parcelas) : 1,
      parcelasPagas: editingDivida?.parcelasPagas || 0,
      valorParcela: formData.tipo === 'parcelada' 
        ? valorParcelaNum 
        : parseFloat(formData.valorTotal),
      dataVencimento: formData.dataVencimento,
      tipo: formData.tipo,
    };

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

    // Criar/atualizar gastos fixos de todas as competências desta dívida
    try {
      const [y, m, d] = novaDivida.dataVencimento.split('-').map(Number);
      const totalParcelas = novaDivida.tipo === 'parcelada' ? novaDivida.parcelas : 1;
      for (let i = 0; i < totalParcelas; i++) {
        const { y: yy, m: mm } = addMonths(y, m, i);
        const ym = `${yy}-${String(mm).padStart(2,'0')}`;
        const valor = getInstallmentValue(novaDivida, i);
        const gastoId = `divida:${novaDivida.id}:${ym}`;
        const gasto: GastoFixo = { id: gastoId, descricao: `Parcela dívida: ${novaDivida.descricao} – ${i+1}/${totalParcelas}`, valor, categoria: 'Dívidas', diaVencimento: d, pago: i < (novaDivida.parcelasPagas || 0) } as any;
        await (saveGastoFixo && saveGastoFixo(gasto));
        setGastosFixos((prev: GastoFixo[]) => {
          const j = prev.findIndex(g => g.id === gastoId);
          if (j >= 0) { const clone = [...prev]; clone[j] = gasto; return clone; }
          return [...prev, gasto];
        });
      }
    } catch {}

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
    });
    setEditingDivida(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (divida: Divida) => {
    setEditingDivida(divida);
    setFormData({
      descricao: divida.descricao,
      valorTotal: divida.valorTotal.toString(),
      parcelas: divida.parcelas.toString(),
      valorParcela: divida.valorParcela.toString(),
      dataVencimento: divida.dataVencimento,
      tipo: divida.tipo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta dívida?')) return;
    await deleteDivida(id);
    setDividas(prev => prev.filter(d => d.id !== id));
  };

  const handlePagamento = (divida: Divida) => {
    setDividaSelecionada(divida);
    setCaixaPagamento(caixas && caixas.length > 0 ? caixas[0].id : null);
    setIsPagamentoOpen(true);
  };

  const processarPagamento = async (valorPagamento: number) => {
    if (!dividaSelecionada) return;
    if (!caixaPagamento) { alert('Selecione um caixa.'); return; }
    // Bloqueio de saldo negativo
    const c = (caixas || []).find((x: any) => x.id === caixaPagamento);
    if (c && c.saldo < valorPagamento) { alert('Saldo insuficiente no caixa selecionado.'); return; }

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
        data: new Date().toISOString().slice(0,10),
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

    setIsPagamentoOpen(false);
    setDividaSelecionada(null);
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

  // Calcular totais
  const totalDividas = dividas.reduce((sum, d) => sum + d.valorTotal, 0);
  const totalPago = dividas.reduce((sum, d) => sum + d.valorPago, 0);
  const totalRestante = totalDividas - totalPago;

  // Dívidas próximas do vencimento (próximos 30 dias)
  const hoje = new Date();
  const proximoMes = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const dividasVencendoSoon = dividas.filter(divida => {
    const vencimento = new Date(divida.dataVencimento);
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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  placeholder="Ex: Cartão de crédito, Empréstimo, etc."
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
                    <p className="text-xs text-muted-foreground">O sistema sugere automaticamente com base no total e parcelas. Você pode ajustar se desejar.</p>
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
      <Dialog open={isPagamentoOpen} onOpenChange={setIsPagamentoOpen}>
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
            {dividas.length} dívida(s) registrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Versão mobile - Lista de cards */}
          <div className="md:hidden space-y-3">
            {dividas.map((divida) => {
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
                        {new Date(divida.dataVencimento).toLocaleDateString('pt-BR')}
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
                      {!isQuitada && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePagamento(divida)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}
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
                {dividas.map((divida) => {
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
                          {new Date(divida.dataVencimento).toLocaleDateString('pt-BR')}
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
                          {!isQuitada && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePagamento(divida)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
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
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
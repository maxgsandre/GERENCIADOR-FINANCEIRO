import React, { useContext, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { FinanceiroContext } from '../App';
import { TrendingUp, TrendingDown, Wallet, CreditCard, PiggyBank, Percent, DollarSign, ArrowUpCircle, ArrowDownCircle, Target, LayoutDashboard } from 'lucide-react';
import { calculateMonthlyTotals, parseYYYYMMDDtoYM, parseYYYYMM } from '../utils/monthlyCalculations';

// Função auxiliar para calcular índice de mês
const ymToIndex = (year: number, month1to12: number) => year * 12 + (month1to12 - 1);

export default function Dashboard() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { caixas, transacoes, gastosFixos, dividas, cofrinhos, cartoes, comprasCartao, receitasPrevistas } = context;

  // Mês selecionado para exibição
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Formatter consistente para 2 casas decimais em pt-BR
  const formatBR2 = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Calcular totais
  // Total em Caixas: alinhar com "Total Geral" da página Caixas
  const [ySel, mSel] = selectedMonth.split('-').map(Number);
  const initialForMonth = (caixa: any, ym: string) => {
    const init = (caixa as any).initialByMonth as Record<string, number> | undefined;
    if (init && Object.prototype.hasOwnProperty.call(init, ym)) {
      return (init as any)[ym] ?? 0;
    }
    // Propagar a partir do último mês conhecido
    const ymToIndex = (y: number, m: number) => y * 12 + (m - 1);
    const parseYM = (ym2: string) => { const [yy, mm] = ym2.split('-').map(Number); return { y: yy, m: mm }; };
    const nextYM = (y: number, m: number) => ({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1 });
    if (!init) return 0;
    let bestKey: string | null = null;
    Object.keys(init).forEach(k => {
      const { y, m } = parseYM(k);
      if (ymToIndex(y, m) <= ymToIndex(ySel, mSel)) {
        if (bestKey === null) bestKey = k; else {
          const { y: by, m: bm } = parseYM(bestKey);
          if (ymToIndex(y, m) > ymToIndex(by, bm)) bestKey = k;
        }
      }
    });
    if (!bestKey) return 0;
    const { y: sy, m: sm } = parseYM(bestKey);
    let current = (init as any)[bestKey] ?? 0;
    let cy = sy, cm = sm;
    while (!(cy === ySel && cm === mSel)) {
      const total = transacoes
        .filter(t => t.caixaId === caixa.id)
        .filter(t => { const d = new Date(t.data + 'T00:00:00'); return d.getFullYear() === cy && d.getMonth() === (cm - 1); })
        .reduce((s, t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
      const n = nextYM(cy, cm);
      current = current + total;
      cy = n.y; cm = n.m;
    }
    return current;
  };
  const monthlyTotalFor = (caixaId: string, y: number, m: number) => {
    return transacoes
      .filter(t => t.caixaId === caixaId)
      .filter(t => { const d = new Date(t.data + 'T00:00:00'); return d.getFullYear() === y && d.getMonth() === (m - 1); })
      .reduce((s, t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
  };
  const totalCaixasSomenteCaixas = caixas.reduce((sum, c) => {
    const inicial = initialForMonth(c, selectedMonth);
    const totalMes = monthlyTotalFor(c.id, ySel, mSel);
    return sum + (inicial + totalMes);
  }, 0);
  const CDI_ANUAL_PERCENT = 10.75;
  const dailyRateFromAnnual = (annualPercent: number) => Math.pow(1 + annualPercent / 100, 1 / 252) - 1;
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
  const principalOf = (c: any) => ((c.valorAplicado || 0) + ((c.aportes || []).reduce((s: number, a: any) => s + a.valor, 0)));
  const computeCdiSaldoLiquido = (c: any) => {
    const percentOfCDI = c.percentualCDI || 0;
    const baseDaily = dailyRateFromAnnual(CDI_ANUAL_PERCENT);
    const daily = baseDaily * (percentOfCDI / 100);
    const aportes = [ ...(c.valorAplicado && c.dataAplicacao ? [{ data: c.dataAplicacao, valor: c.valorAplicado }] : []), ...(c.aportes || []) ];
    const principal = principalOf(c);
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
    return principal + rendimentoLiquido;
  };

  const computeCdiRendimentoMensal = (c: any) => {
    const percentOfCDI = c.percentualCDI || 0;
    const annual = (percentOfCDI / 100) * CDI_ANUAL_PERCENT; // % a.a.
    const principal = principalOf(c);
    return (principal * annual) / 12 / 100; // R$ por mês (aprox.)
  };

  const totalCofrinhos = cofrinhos.reduce((sum, cofrinho) => sum + (cofrinho.tipo === 'cdi' ? computeCdiSaldoLiquido(cofrinho) : cofrinho.saldo), 0);
  const totalCaixas = totalCaixasSomenteCaixas + totalCofrinhos;
  
  // Total de investimentos: soma de todos os cofrinhos já com rendimentos
  const totalInvestimentos = totalCofrinhos;
  
  // Rendimentos mensais (aprox) para exibição de resumo financeiro
  const totalRendimentoMensal = cofrinhos.reduce((sum, c) => sum + (c.tipo === 'cdi' ? computeCdiRendimentoMensal(c) : (c.rendimentoMensal || 0)), 0);
  // Rendimento total acumulado dos cofrinhos (desde a aplicação)
  const totalRendimentoAcumulado = cofrinhos.reduce((sum, c) => {
    if (c.tipo === 'cdi') {
      const saldoLiq = computeCdiSaldoLiquido(c);
      const principal = principalOf(c);
      return sum + Math.max(0, saldoLiq - principal);
    }
    const principal = principalOf(c) || 0;
    return sum + Math.max(0, (c.saldo || 0) - principal);
  }, 0);
  
  const totalDividas = dividas.reduce((sum, divida) => sum + (divida.valorTotal - divida.valorPago), 0);

  // Entradas e saídas do mês selecionado
  const [anoSelecionado, mesSelecionado] = selectedMonth.split('-').map(Number);
  
  const transacoesMesSelecionado = transacoes.filter(t => {
    const dataTransacao = new Date(t.data + 'T00:00:00');
    return dataTransacao.getMonth() === (mesSelecionado - 1) && dataTransacao.getFullYear() === anoSelecionado;
  });

  const entradasMes = transacoesMesSelecionado
    .filter(t => t.tipo === 'entrada' && !t.ignorarDashboard)
    .reduce((sum, t) => sum + t.valor, 0);

  const saidasMes = transacoesMesSelecionado
    .filter(t => t.tipo === 'saida' && !t.ignorarDashboard)
    .reduce((sum, t) => sum + t.valor, 0);

  // Filtrar receitas apenas do mês selecionado
  const receitasDoMes = receitasPrevistas.filter(r => {
    if (!r.periodo) {
      // Compatibilidade: receitas antigas sem período
      const dataVenc = new Date(r.dataVencimento + 'T00:00:00');
      const periodoReceita = `${dataVenc.getFullYear()}-${String(dataVenc.getMonth() + 1).padStart(2, '0')}`;
      return periodoReceita === selectedMonth;
    }
    return r.periodo === selectedMonth;
  });
  
  // Calcular total de receitas previstas do mês selecionado
  const totalReceitasPrevistas = receitasDoMes.reduce((sum, receita) => sum + receita.valor, 0);

  // Calcular gastos fixos do mês selecionado
  const gastosFixosDoMes = gastosFixos.filter(gasto => {
    if (gasto.periodo) {
      return gasto.periodo === selectedMonth;
    }
    // Compatibilidade: gastos antigos sem período - usar dataVencimento
    if (gasto.dataVencimento) {
      try {
        const dataVenc = new Date(gasto.dataVencimento + 'T00:00:00');
        if (!isNaN(dataVenc.getTime())) {
          const periodoGasto = `${dataVenc.getFullYear()}-${String(dataVenc.getMonth() + 1).padStart(2, '0')}`;
          return periodoGasto === selectedMonth;
        }
      } catch {}
    }
    return false;
  });

  // Incluir compras de cartão como dívidas (usando mesma lógica do DividasManager)
  const comprasCartaoAsDividas = (comprasCartao as any[]).map((c) => {
    const card = (cartoes as any[]).find(x => x.id === c.cardId);
    const dueDay = (card?.diaVencimento ?? c.startDay ?? 5);
    
    // Usar apenas os dados da compra (não há mais gastos fixos automáticos)
    const parcelasPagasAtualizadas = c.parcelasPagas || 0;
    const valorPagoEstimado = Math.min(c.parcelas, parcelasPagasAtualizadas) * c.valorParcela + (parcelasPagasAtualizadas === c.parcelas ? (Math.round(c.valorTotal * 100) - Math.round(c.valorParcela * 100) * c.parcelas) / 100 : 0);
    
    // Ajustar data de vencimento para o mês selecionado
    const dataVencimentoAjustada = `${anoSelecionado}-${String(mesSelecionado).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`;
    
    return {
      id: `purchase:${c.id}`,
      descricao: `Cartão ${(cartoes as any[]).find(x => x.id === c.cardId)?.nome || ''}: ${c.descricao}`,
      valorTotal: c.valorTotal,
      valorPago: valorPagoEstimado,
      parcelas: c.parcelas,
      parcelasPagas: parcelasPagasAtualizadas,
      valorParcela: c.valorParcela,
      dataVencimento: dataVencimentoAjustada,
      tipo: c.parcelas > 1 ? 'parcelada' : 'total',
    };
  });

  // Calcular total de gastos fixos do mês selecionado
  const totalGastosFixosMes = gastosFixosDoMes.reduce((sum, gasto) => sum + gasto.valor, 0);

  // Filtrar dívidas do mês selecionado (mesma lógica do DividasManager)
  const { y: selY, m: selM } = parseYYYYMM(selectedMonth);
  const dividasFiltradas = dividas.filter((d) => {
    // Se tem período, usar ele diretamente (nova estrutura)
    if (d.periodo) {
      return d.periodo === selectedMonth;
    }
    
    // Compatibilidade: lógica antiga para dívidas sem período
    if (d.tipo === 'parcelada') {
      const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
      const idx = ymToIndex(selY, selM) - ymToIndex(startYM.y, startYM.m);
      return idx >= 0 && idx < d.parcelas;
    }

    const { y: y0, m: m0 } = parseYYYYMMDDtoYM(d.dataVencimento);
    return y0 === selY && m0 === selM;
  });

  // Calcular totais mensais usando utilitário compartilhado
  // Usar apenas as dívidas filtradas do mês selecionado
  const { monthlyTotal, monthlyPaid, monthlyRemaining, monthlyCount } = calculateMonthlyTotals(
    dividasFiltradas,
    comprasCartao,
    cartoes,
    selectedMonth,
    transacoes
  );

  // Total de gastos do mês = gastos fixos + parcelas de dívidas + parcelas de cartão
  const totalGastosMes = totalGastosFixosMes + monthlyTotal;

  // Calcular previsão de déficit/superávit
  const previsaoDeficitSuperavit = totalReceitasPrevistas - totalGastosMes;

  // Calcular dívidas do mês selecionado (incluindo compras de cartão)
  const dividasDoMes = dividas.filter(divida => {
    const dataVencimento = new Date(divida.dataVencimento);
    return dataVencimento.getMonth() === (mesSelecionado - 1) && dataVencimento.getFullYear() === anoSelecionado;
  });

  // Calcular valor restante total a pagar de todas as dívidas
  const totalDividasRestante = dividas.reduce((sum, divida) => sum + (divida.valorTotal - divida.valorPago), 0);
  
  // Calcular valor restante das compras de cartão
  const totalComprasCartaoRestante = comprasCartao.reduce((sum, compra) => {
    const valorPago = (compra.parcelasPagas || 0) * compra.valorParcela;
    return sum + (compra.valorTotal - valorPago);
  }, 0);
  
  const totalDividasMes = totalDividasRestante + totalComprasCartaoRestante;
  const totalParcelasMes = monthlyTotal;


  // Dados para gráfico de barras - distribuição por caixa
  const dadosCaixas = caixas.map(caixa => {
    const inicial = initialForMonth(caixa, selectedMonth);
    const totalMes = monthlyTotalFor(caixa.id, ySel, mSel);
    return { nome: caixa.nome, saldo: inicial + totalMes };
  });

  // Filtrar dívidas esporádicas do mês (criadaViaTransacao: true, não parceladas, não cartão)
  const dividasEsporadicasDoMes = dividasFiltradas.filter(d => {
    // Deve ter criadaViaTransacao: true
    if (!(d as any).criadaViaTransacao) return false;
    
    // Excluir dívidas parceladas
    if (d.tipo === 'parcelada') return false;
    
    // Excluir dívidas de cartão (identificadas por id ou categoria)
    if (d.id.startsWith('card:') || d.id.startsWith('purchase:') || d.categoria === 'Cartão de Crédito') {
      return false;
    }
    
    return true;
  });

  // Dados para gráfico de pizza - gastos por categoria (apenas do mês filtrado)
  const gastosPorCategoria = gastosFixosDoMes
    .reduce((acc, gasto) => {
      acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.valor;
      return acc;
    }, {} as Record<string, number>);

  // Adicionar gastos esporádicos (dívidas criadaViaTransacao) por categoria
  dividasEsporadicasDoMes.forEach(divida => {
    const categoria = divida.categoria || 'Esporádicos';
    gastosPorCategoria[categoria] = (gastosPorCategoria[categoria] || 0) + divida.valorTotal;
  });

  const dadosGastos = Object.entries(gastosPorCategoria).map(([categoria, valor]) => ({
    name: categoria,
    value: valor,
  }));

  // Dados separados para gráficos de Gastos Esporádicos
  const gastosEsporadicosPorCategoria = dividasEsporadicasDoMes
    .reduce((acc, divida) => {
      const categoria = divida.categoria || 'Esporádicos';
      acc[categoria] = (acc[categoria] || 0) + divida.valorTotal;
      return acc;
    }, {} as Record<string, number>);

  const dadosGastosEsporadicos = Object.entries(gastosEsporadicosPorCategoria).map(([categoria, valor]) => ({
    name: categoria,
    value: valor,
  }));

  const totalGastosCategorias = dadosGastos.reduce((sum, d) => sum + (d.value as number), 0);
  const maxValorCategoria = dadosGastos.reduce((m, d) => Math.max(m, d.value as number), 0);
  const yAxisMax = maxValorCategoria > 0 ? maxValorCategoria * 1.15 : 1;

  // Calcular totais e máximos para gastos esporádicos
  const totalGastosEsporadicos = dadosGastosEsporadicos.reduce((sum, d) => sum + (d.value as number), 0);
  const maxValorEsporadico = dadosGastosEsporadicos.reduce((m, d) => Math.max(m, d.value as number), 0);
  const yAxisMaxEsporadico = maxValorEsporadico > 0 ? maxValorEsporadico * 1.15 : 1;

  const cores = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  return (
    <div className="space-y-6">
      {/* Cabeçalho compacto */}
      <div className="flex flex-col gap-3 pb-2 border-b">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Dashboard</h2>
              <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
            </div>
          </div>
          
          {/* Controles - Desktop/Tablet */}
          <div className="hidden md:flex items-center gap-2">
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              className="w-[180px] !h-8" 
            />
          </div>
        </div>
        
        {/* Controles - Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <Input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            className="w-[160px] h-9" 
          />
        </div>
      </div>

      {/* Cards de resumo principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total em Caixas</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {formatBR2.format(totalCaixas)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Entradas do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {entradasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Saídas do Mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {saidasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Gastos Fixos do Mês</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R$ {totalGastosFixosMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Parcelas Dívidas do Mês</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalParcelasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Investimentos Totais</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {formatBR2.format(totalInvestimentos)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Resumo Financeiro
          </CardTitle>
          <CardDescription>Visão geral das suas finanças</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2" style={{ minWidth: '180px', flex: '1 1 auto' }}>
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Total de Receitas Previstas</p>
              </div>
              <p className="text-xl font-semibold text-green-600">
                R$ {totalReceitasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="space-y-2" style={{ minWidth: '180px', flex: '1 1 auto' }}>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-orange-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Gastos Totais do Mês</p>
              </div>
              <p className="text-xl font-semibold text-orange-600">
                R$ {totalGastosMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="space-y-2" style={{ minWidth: '180px', flex: '1 1 auto' }}>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Gastos Esporádicos do Mês</p>
              </div>
              <p className="text-xl font-semibold text-red-600">
                R$ {totalGastosEsporadicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="space-y-2" style={{ minWidth: '180px', flex: '1 1 auto' }}>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Previsão de Déficit/Superávit</p>
              </div>
              <p className={`text-xl font-semibold ${previsaoDeficitSuperavit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {previsaoDeficitSuperavit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="space-y-2" style={{ minWidth: '180px', flex: '1 1 auto' }}>
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Rendimentos</p>
              </div>
              <p className="text-xl font-semibold text-blue-600">
                +R$ {totalRendimentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
              </p>
            </div>
          </div>
          
          {/* Balanço do mês destacado */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Balanço do Mês</span>
              </div>
              <p className={`text-2xl font-bold ${(entradasMes - saidasMes) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {(entradasMes - saidasMes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            {(entradasMes - saidasMes) >= 0 && (
              <p className="text-sm text-green-600 mt-1">
                ✅ Você economizou este mês!
              </p>
            )}
            {(entradasMes - saidasMes) < 0 && (
              <p className="text-sm text-red-600 mt-1">
                ⚠️ Gastos superaram as entradas
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Caixa</CardTitle>
            <CardDescription>Saldo atual em cada caixa</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosCaixas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo']}
                />
                <Bar dataKey="saldo" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos Fixos por Categoria</CardTitle>
            <CardDescription>Distribuição dos gastos mensais</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosGastos}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={1}
                >
                  {dadosGastos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={cores[index % cores.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de barras - Gastos por categoria */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
            <CardDescription>Valores em reais por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <ResponsiveContainer width={Math.max(400, dadosGastos.length * 80)} height={300}>
                <BarChart data={dadosGastos} margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    domain={[0, yAxisMax]}
                  />
                  <Tooltip 
                    formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                  />
                  <Bar dataKey="value">
                    <LabelList position="top" content={(props: any) => {
                      const { x, y, width, value } = props;
                      const pct = totalGastosCategorias > 0 ? (Number(value) / totalGastosCategorias) * 100 : 0;
                      return (
                        <text x={x + width / 2} y={y - 6} fill="#9ca3af" textAnchor="middle" fontSize={12}>
                          {`${pct.toFixed(0)}%`}
                        </text>
                      );
                    }} />
                    {dadosGastos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={cores[index % cores.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Gastos Esporádicos */}
      {dadosGastosEsporadicos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Gastos Esporádicos por Categoria</CardTitle>
              <CardDescription>Distribuição dos gastos não planejados</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dadosGastosEsporadicos}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={1}
                  >
                    {dadosGastosEsporadicos.map((entry, index) => (
                      <Cell key={`cell-esporadico-${index}`} fill={cores[index % cores.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de barras - Gastos Esporádicos por categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Gastos Esporádicos por Categoria</CardTitle>
              <CardDescription>Valores em reais por categoria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <ResponsiveContainer width={Math.max(400, dadosGastosEsporadicos.length * 80)} height={300}>
                  <BarChart data={dadosGastosEsporadicos} margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      domain={[0, yAxisMaxEsporadico]}
                    />
                    <Tooltip 
                      formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                    />
                    <Bar dataKey="value">
                      <LabelList position="top" content={(props: any) => {
                        const { x, y, width, value } = props;
                        const pct = totalGastosEsporadicos > 0 ? (Number(value) / totalGastosEsporadicos) * 100 : 0;
                        return (
                          <text x={x + width / 2} y={y - 6} fill="#9ca3af" textAnchor="middle" fontSize={12}>
                            {`${pct.toFixed(0)}%`}
                          </text>
                        );
                      }} />
                      {dadosGastosEsporadicos.map((entry, index) => (
                        <Cell key={`cell-esporadico-bar-${index}`} fill={cores[index % cores.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cards dos Cofrinhos */}
      {cofrinhos.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Cofrinhos</h3>
              <div className="text-sm text-muted-foreground">
              Total: R$ {formatBR2.format(Number(totalCofrinhos))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {cofrinhos.map((cofrinho) => {
              const progressoObjetivo = cofrinho.objetivo 
                ? (cofrinho.saldo / cofrinho.objetivo) * 100 
                : 0;
              const saldoMostrar = cofrinho.tipo === 'cdi' ? computeCdiSaldoLiquido(cofrinho) : cofrinho.saldo;
              const rendimentoMesMostrar = cofrinho.tipo === 'cdi' ? computeCdiRendimentoMensal(cofrinho) : (cofrinho.rendimentoMensal || 0);
              return (
                <Card key={cofrinho.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: cofrinho.cor }}
                        />
                        <h4 className="font-medium">{cofrinho.nome}</h4>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Percent className="h-3 w-3 mr-1" />
                        {cofrinho.percentualCDI}% CDI
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Saldo</span>
                        <span className="font-medium text-green-600">
                          R$ {formatBR2.format(saldoMostrar)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Rendimento/mês</span>
                        <span className="text-sm font-medium text-green-600">
                          +R$ {rendimentoMesMostrar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      {cofrinho.objetivo && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Objetivo</span>
                            <span className="text-sm font-medium">
                              R$ {cofrinho.objetivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all"
                              style={{ 
                                width: `${Math.min(progressoObjetivo, 100)}%`,
                                backgroundColor: cofrinho.cor 
                              }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground text-center">
                            {progressoObjetivo.toFixed(1)}% concluído
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <PiggyBank className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Rendimento Total dos Cofrinhos</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    +R$ {totalRendimentoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    (+R$ {totalRendimentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
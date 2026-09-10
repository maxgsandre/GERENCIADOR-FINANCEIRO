import React, { useContext, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { FinanceiroContext } from '../App';
import { TrendingUp, TrendingDown, Wallet, CreditCard, PiggyBank, Percent, ArrowUpCircle, Target, LayoutDashboard } from 'lucide-react';
import { getMonthlyDue, mapPurchasesAsDividas, getDividasDoMes } from '../utils/monthlyCalculations';
import {
  initialForMonth as initialForMonthShared,
  monthlyTotalFor as monthlyTotalForShared,
  principalOf,
  computeCdiSaldoLiquido,
  computeCdiRendimentoMensal,
} from '../utils/cofrinhoCalculations';

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
  const formatBRCompact = new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const formatBROne = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const formatCurrencyAxisTick = (value: number) => {
    const numericValue = Number(value) || 0;

    if (Math.abs(numericValue) < 1000) {
      return `R$ ${formatBROne.format(numericValue)}`;
    }

    return `R$ ${formatBRCompact.format(numericValue)}`;
  };

  // Calcular totais
  // Total em Caixas: alinhar com "Total Geral" da página Caixas
  const [ySel, mSel] = selectedMonth.split('-').map(Number);
  const initialForMonth = (caixa: any, ym: string) => initialForMonthShared(caixa, ym, transacoes);
  const monthlyTotalFor = (caixaId: string, y: number, m: number) =>
    monthlyTotalForShared(transacoes, caixaId, y, m);
  const totalCaixasSomenteCaixas = caixas.reduce((sum, c) => {
    const inicial = initialForMonth(c, selectedMonth);
    const totalMes = monthlyTotalFor(c.id, ySel, mSel);
    return sum + (inicial + totalMes);
  }, 0);

  const totalCofrinhos = cofrinhos.reduce((sum, cofrinho) => sum + (cofrinho.tipo === 'cdi' ? computeCdiSaldoLiquido(cofrinho) : cofrinho.saldo), 0);
  // Total em Caixas: apenas caixas, sem cofrinhos
  const totalCaixas = totalCaixasSomenteCaixas;
  
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
  
  const totalDividas = dividas
    .filter((divida) => !divida.inativa)
    .reduce((sum, divida) => sum + (divida.valorTotal - divida.valorPago), 0);

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

  // Calcular total de gastos fixos do mês selecionado
  const totalGastosFixosMes = gastosFixosDoMes.reduce((sum, gasto) => sum + gasto.valor, 0);

  // Filtrar dívidas do mês selecionado (mesma lógica do DividasManager)
  const dividasFiltradas = getDividasDoMes(dividas, selectedMonth);

  const comprasCartaoDoMes = mapPurchasesAsDividas(comprasCartao, cartoes, selectedMonth);

  const dividasParceladasDoMes = dividasFiltradas.filter((divida) => divida.tipo === 'parcelada');
  const comprasCartaoParceladasDoMes = comprasCartaoDoMes.filter(
    (compra) => compra.tipo === 'parcelada' && getMonthlyDue(compra, selectedMonth) > 0
  );
  const dividasEsporadicasDoMes = dividasFiltradas.filter((divida) => divida.tipo === 'total');

  const totalDividasParceladasMes =
    dividasParceladasDoMes.reduce((sum, divida) => sum + getMonthlyDue(divida, selectedMonth), 0) +
    comprasCartaoParceladasDoMes.reduce((sum, compra) => sum + getMonthlyDue(compra, selectedMonth), 0);
  const totalParcelasCartaoMes = comprasCartaoParceladasDoMes.reduce(
    (sum, compra) => sum + getMonthlyDue(compra, selectedMonth),
    0
  );
  const totalDividasEsporadicasMes = dividasEsporadicasDoMes.reduce(
    (sum, divida) => sum + getMonthlyDue(divida, selectedMonth),
    0
  );
  const totalGastoPrevisto = totalGastosFixosMes + totalDividasParceladasMes;
  const totalGastosMes = totalGastosFixosMes + totalDividasParceladasMes + totalDividasEsporadicasMes;

  // Calcular previsão de déficit/superávit
  const previsaoDeficitSuperavit = totalReceitasPrevistas - totalGastosMes;


  // Dados para gráfico de barras - distribuição por caixa
  const dadosCaixas = caixas.map(caixa => {
    const inicial = initialForMonth(caixa, selectedMonth);
    const totalMes = monthlyTotalFor(caixa.id, ySel, mSel);
    return { nome: caixa.nome, saldo: inicial + totalMes };
  });

  // Dados para gráfico de pizza - gastos por categoria (apenas do mês filtrado)
  const gastosPorCategoria = gastosFixosDoMes
    .reduce((acc, gasto) => {
      acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.valor;
      return acc;
    }, {} as Record<string, number>);

  // Adicionar dívidas esporádicas da lista por categoria
  dividasEsporadicasDoMes.forEach(divida => {
    const categoria = divida.categoria || 'Esporádicos';
    gastosPorCategoria[categoria] = (gastosPorCategoria[categoria] || 0) + getMonthlyDue(divida, selectedMonth);
  });

  const dadosGastos = Object.entries(gastosPorCategoria).map(([categoria, valor]) => ({
    name: categoria,
    value: valor,
  }));

  // Dados separados para gráficos de Gastos Esporádicos
  const gastosEsporadicosPorCategoria = dividasEsporadicasDoMes
    .reduce((acc, divida) => {
      const categoria = divida.categoria || 'Esporádicos';
      acc[categoria] = (acc[categoria] || 0) + getMonthlyDue(divida, selectedMonth);
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
            <CardTitle className="text-sm">Dívidas Parceladas do Mês</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalDividasParceladasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Dívidas Esporádicas Mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalDividasEsporadicasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                <p className="text-sm text-muted-foreground whitespace-nowrap">Total de Gastos Previsto</p>
              </div>
              <p className="text-xl font-semibold text-orange-600">
                R$ {totalGastoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="space-y-2" style={{ minWidth: '180px', flex: '1 1 auto' }}>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Parcelas de Cartão do Mês</p>
              </div>
              <p className="text-xl font-semibold text-red-600">
                R$ {totalParcelasCartaoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                <TrendingUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Previsão de Déficit/Superávit</p>
              </div>
              <p className={`text-xl font-semibold ${previsaoDeficitSuperavit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {previsaoDeficitSuperavit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                <YAxis width={80} tickFormatter={formatCurrencyAxisTick} />
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
                    width={80}
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatCurrencyAxisTick}
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
                      width={80}
                      tick={{ fontSize: 12 }}
                      tickFormatter={formatCurrencyAxisTick}
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
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Rendimentos mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              +R$ {totalRendimentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Rendimento Total dos Cofrinhos</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +R$ {totalRendimentoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Acumulado de todos os cofrinhos
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

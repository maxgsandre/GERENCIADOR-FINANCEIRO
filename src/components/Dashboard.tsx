import React, { useContext, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FinanceiroContext } from '../App';
import { TrendingUp, TrendingDown, Wallet, CreditCard, PiggyBank, Percent } from 'lucide-react';

export default function Dashboard() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { caixas, transacoes, gastosFixos, dividas, cofrinhos } = context;

  // Mês selecionado para exibição
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calcular totais
  const totalCaixas = caixas.reduce((sum, caixa) => sum + caixa.saldo, 0);
  const totalCofrinhos = cofrinhos.reduce((sum, cofrinho) => sum + cofrinho.saldo, 0);
  const totalRendimentoMensal = cofrinhos.reduce((sum, cofrinho) => sum + cofrinho.rendimentoMensal, 0);
  const totalDividas = dividas.reduce((sum, divida) => sum + (divida.valorTotal - divida.valorPago), 0);
  const totalGastosFixos = gastosFixos.reduce((sum, gasto) => sum + gasto.valor, 0);

  // Entradas e saídas do mês selecionado
  const [anoSelecionado, mesSelecionado] = selectedMonth.split('-').map(Number);
  
  const transacoesMesSelecionado = transacoes.filter(t => {
    const dataTransacao = new Date(t.data);
    return dataTransacao.getMonth() === (mesSelecionado - 1) && dataTransacao.getFullYear() === anoSelecionado;
  });

  const entradasMes = transacoesMesSelecionado
    .filter(t => t.tipo === 'entrada')
    .reduce((sum, t) => sum + t.valor, 0);

  const saidasMes = transacoesMesSelecionado
    .filter(t => t.tipo === 'saida')
    .reduce((sum, t) => sum + t.valor, 0);

  // Dados para gráfico de barras - distribuição por caixa
  const dadosCaixas = caixas.map(caixa => ({
    nome: caixa.nome,
    saldo: caixa.saldo,
  }));

  // Dados para gráfico de pizza - gastos por categoria
  const gastosPorCategoria = gastosFixos
    .reduce((acc, gasto) => {
      acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.valor;
      return acc;
    }, {} as Record<string, number>);

  const dadosGastos = Object.entries(gastosPorCategoria).map(([categoria, valor]) => ({
    name: categoria,
    value: valor,
  }));

  const cores = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  return (
    <div className="space-y-6">
      {/* Seletor de mês */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">
            Visão geral das suas finanças
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-muted-foreground">Mês</div>
          <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-[180px]" />
        </div>
      </div>

      {/* Cards de resumo principais */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total em Caixas</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalCaixas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
            <CardTitle className="text-sm">Total Dívidas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalDividas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo financeiro */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Financeiro</CardTitle>
          <CardDescription>Informações principais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Gastos Fixos Mensais</p>
              <p className="text-lg font-medium">
                R$ {totalGastosFixos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Saldo Líquido (Caixas - Dívidas)</p>
              <p className={`text-lg font-medium ${(totalCaixas - totalDividas) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {(totalCaixas - totalDividas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total em Cofrinhos</p>
              <p className="text-lg font-medium text-blue-600">
                R$ {totalCofrinhos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Balanço do Mês</p>
              <p className={`text-lg font-medium ${(entradasMes - saidasMes) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {(entradasMes - saidasMes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
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
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dadosGastos}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
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
      </div>

      {/* Cards dos Cofrinhos */}
      {cofrinhos.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Cofrinhos</h3>
            <div className="text-sm text-muted-foreground">
              Total: R$ {totalCofrinhos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {cofrinhos.map((cofrinho) => {
              const progressoObjetivo = cofrinho.objetivo 
                ? (cofrinho.saldo / cofrinho.objetivo) * 100 
                : 0;
                
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
                          R$ {cofrinho.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Rendimento/mês</span>
                        <span className="text-sm font-medium text-green-600">
                          +R$ {cofrinho.rendimentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                <span className="text-lg font-bold text-green-600">
                  +R$ {totalRendimentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
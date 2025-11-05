import { Divida, CompraCartao, CartaoCredito } from '../App';

// Função para converter YYYY-MM para objeto {y, m}
export const parseYYYYMM = (s: string) => {
  const [y, m] = s.split('-').slice(0, 2).map(Number);
  return { y, m };
};

// Função para converter YYYY-MM-DD para objeto {y, m}
export const parseYYYYMMDDtoYM = (s: string) => {
  const [y, m] = s.split('-').slice(0, 2).map(Number);
  return { y, m };
};

// Função para calcular índice de mês
export const ymToIndex = (year: number, month1to12: number) => year * 12 + (month1to12 - 1);

// Função para calcular valor devido no mês
export const getMonthlyDue = (d: Divida | CompraCartao, selectedMonth: string): number => {
  // Se tem período, verificar diretamente (estrutura nova por mês)
  if ((d as any).periodo && (d as any).periodo === selectedMonth) {
    if (d.tipo === 'parcelada') {
      // Para parceladas, usar valorParcela diretamente
      return (d.valorParcela || 0);
    }
    // Para não parceladas, usar valorTotal
    return (d.valorTotal || 0);
  }
  
  // Fallback: lógica antiga para dívidas sem período (compatibilidade)
  if (d.tipo === 'parcelada') {
    const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
    const selectedYM = parseYYYYMM(selectedMonth);
    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
    if (idx < 0 || idx >= d.parcelas) return 0;
    const base = d.valorParcela;
    const delta = Math.round(d.valorTotal * 100) - Math.round(base * 100) * d.parcelas;
    const isLast = idx === d.parcelas - 1;
    const valor = base + (isLast ? delta / 100 : 0);
    return Math.max(0, valor);
  }
  
  // Para dívidas não parceladas, verificar se vence no mês selecionado
  const dataVencimento = new Date(d.dataVencimento);
  const [anoSelecionado, mesSelecionado] = selectedMonth.split('-').map(Number);
  const mesVencimento = dataVencimento.getMonth() + 1;
  const anoVencimento = dataVencimento.getFullYear();
  if (mesVencimento === mesSelecionado && anoVencimento === anoSelecionado) {
    return d.valorTotal;
  }
  return 0;
};

// Função para calcular valor pago no mês (baseado em parcelasPagas, não transações)
export const getMonthlyPaid = (d: Divida | CompraCartao, transacoes: any[], selectedMonth: string, cartoes?: any[]): number => {
  // Para dívidas parceladas: calcular baseado em parcelasPagas
  if (d.tipo === 'parcelada' && d.parcelas > 1) {
    const parcelasPagas = d.parcelasPagas || 0;
    const totalParcelas = d.parcelas || 1;
    const valorParcela = d.valorParcela || (d.valorTotal / totalParcelas);
    
    // Calcular valor total pago baseado nas parcelas pagas
    const valorPago = parcelasPagas * valorParcela;
    
    // Se todas as parcelas foram pagas, incluir ajuste de centavos
    if (parcelasPagas >= totalParcelas) {
      const ajusteCentavos = Math.round(d.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
      return (valorPago + ajusteCentavos / 100);
    }
    
    // Para o mês selecionado, verificar se a parcela deste mês foi paga
    const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
    const selectedYM = parseYYYYMM(selectedMonth);
    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
    
    // Se a parcela deste mês foi paga (idx < parcelasPagas), retornar valor da parcela
    if (idx >= 0 && idx < totalParcelas && idx < parcelasPagas) {
      const base = valorParcela;
      const isLast = idx === totalParcelas - 1;
      const delta = Math.round(d.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
      return base + (isLast ? delta / 100 : 0);
    }
    
    return 0;
  }
  
  // Para compras de cartão mapeadas como dívidas: usar parcelasPagas
  if (d.id && d.id.includes('purchase:')) {
    const parcelasPagas = d.parcelasPagas || 0;
    const totalParcelas = d.parcelas || 1;
    const valorParcela = d.valorParcela || (d.valorTotal / totalParcelas);
    
    // Calcular valor total pago baseado nas parcelas pagas
    const valorPago = parcelasPagas * valorParcela;
    
    // Se todas as parcelas foram pagas, incluir ajuste de centavos
    if (parcelasPagas >= totalParcelas) {
      const ajusteCentavos = Math.round(d.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
      return (valorPago + ajusteCentavos / 100);
    }
    
    // Para o mês selecionado, verificar se a parcela deste mês foi paga
    const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
    const selectedYM = parseYYYYMM(selectedMonth);
    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
    
    // Se a parcela deste mês foi paga (idx < parcelasPagas), retornar valor da parcela
    if (idx >= 0 && idx < totalParcelas && idx < parcelasPagas) {
      const base = valorParcela;
      const isLast = idx === totalParcelas - 1;
      const delta = Math.round(d.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
      return base + (isLast ? delta / 100 : 0);
    }
    
    return 0;
  }
  
  // Para dívidas à vista (tipo 'total'): usar valorPago diretamente
  const valorPago = (d as any).valorPago || 0;
  const valorDue = getMonthlyDue(d, selectedMonth);
  
  // Se o valor pago é maior ou igual ao valor devido, retornar o valor devido
  if (valorPago >= valorDue) {
    return valorDue;
  }
  
  // Caso contrário, retornar o valor pago (pagamento parcial)
  return valorPago;
};

// Função para mapear compras de cartão como dívidas
export const mapPurchasesAsDividas = (
  comprasCartao: CompraCartao[], 
  cartoes: CartaoCredito[], 
  selectedMonth: string
): Divida[] => {
  const [anoSelecionado, mesSelecionado] = selectedMonth.split('-').map(Number);
  
  return comprasCartao.map((c) => {
    const card = cartoes.find(x => x.id === c.cardId);
    const dueDay = (card?.diaVencimento ?? c.startDay ?? 5);
    
    const parcelasPagasAtualizadas = c.parcelasPagas || 0;
    const valorPagoEstimado = Math.min(c.parcelas, parcelasPagasAtualizadas) * c.valorParcela + 
      (parcelasPagasAtualizadas === c.parcelas ? (Math.round(c.valorTotal * 100) - Math.round(c.valorParcela * 100) * c.parcelas) / 100 : 0);
    
    // Ajustar data de vencimento para o mês selecionado
    const dataVencimentoAjustada = `${anoSelecionado}-${String(mesSelecionado).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`;
    
    return {
      id: `purchase:${c.id}`,
      descricao: `Cartão ${card?.nome || 'Desconhecido'}: ${c.descricao}`,
      valorTotal: c.valorTotal,
      valorPago: valorPagoEstimado,
      parcelasPagas: parcelasPagasAtualizadas,
      parcelas: c.parcelas,
      valorParcela: c.valorParcela,
      dataVencimento: dataVencimentoAjustada,
      categoria: 'Cartão de Crédito',
      tipo: c.parcelas > 1 ? 'parcelada' : 'total',
      pago: false, // Adicionar campo pago para compatibilidade
      cardId: c.cardId, // Incluir cardId para referência
    };
  });
};

// Função principal para calcular totais mensais
export const calculateMonthlyTotals = (
  dividas: Divida[],
  comprasCartao: CompraCartao[],
  cartoes: CartaoCredito[],
  selectedMonth: string,
  transacoes: any[] = []
) => {
  const purchasesAsDividas = mapPurchasesAsDividas(comprasCartao, cartoes, selectedMonth);
  
  // Totais das dívidas originais
  const monthlyTotalDividas = dividas.reduce((sum, d) => sum + getMonthlyDue(d, selectedMonth), 0);
  const monthlyPaidDividas = dividas.reduce((sum, d) => sum + getMonthlyPaid(d, transacoes, selectedMonth, cartoes), 0);
  
  // Totais incluindo compras de cartão
  const monthlyTotal = monthlyTotalDividas + purchasesAsDividas.reduce((sum, d) => sum + getMonthlyDue(d, selectedMonth), 0);
  const monthlyPaid = monthlyPaidDividas + purchasesAsDividas.reduce((sum, d) => sum + getMonthlyPaid(d, transacoes, selectedMonth, cartoes), 0);
  const monthlyRemaining = Math.max(0, monthlyTotal - monthlyPaid);
  const monthlyCount = dividas.filter(d => getMonthlyDue(d, selectedMonth) > 0).length + 
    purchasesAsDividas.filter(d => getMonthlyDue(d, selectedMonth) > 0).length;

  return {
    monthlyTotal,
    monthlyPaid,
    monthlyRemaining,
    monthlyCount,
    purchasesAsDividas,
    monthlyTotalDividas,
    monthlyPaidDividas
  };
};

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

// Função para calcular valor pago no mês (baseado em valorPago quando disponível, senão parcelasPagas)
export const getMonthlyPaid = (d: Divida | CompraCartao, transacoes: any[], selectedMonth: string, cartoes?: any[]): number => {
  // Se tem valorPago, usar ele (prioridade para compras de cartão e dívidas com valorPago)
  const valorPagoTotal = (d as any).valorPago;
  const hasValorPago = valorPagoTotal !== undefined && valorPagoTotal !== null;
  
  // Para dívidas parceladas: usar valorPago se disponível, senão calcular baseado em parcelasPagas
  if (d.tipo === 'parcelada' && d.parcelas > 1) {
    const totalParcelas = d.parcelas || 1;
    const valorParcela = d.valorParcela || (d.valorTotal / totalParcelas);
    
    // Para o mês selecionado, calcular o valor devido da parcela deste mês
    const startYM = parseYYYYMMDDtoYM(d.dataVencimento);
    const selectedYM = parseYYYYMM(selectedMonth);
    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
    
    // Se não tem parcela neste mês, retornar 0
    if (idx < 0 || idx >= totalParcelas) {
      return 0;
    }
    
    // Calcular valor da parcela deste mês
    const base = valorParcela;
    const isLast = idx === totalParcelas - 1;
    const delta = Math.round(d.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
    const valorParcelaMes = base + (isLast ? delta / 100 : 0);
    
    // Se tem valorPago, usar ele para calcular quanto foi pago desta parcela
    if (hasValorPago) {
      // Calcular quanto foi pago até esta parcela (incluindo)
      let valorPagoAteEstaParcela = 0;
      for (let i = 0; i <= idx && i < totalParcelas; i++) {
        const isLastParcela = i === totalParcelas - 1;
        const valorParcelaI = base + (isLastParcela ? delta / 100 : 0);
        valorPagoAteEstaParcela += valorParcelaI;
      }
      
      // Se o valorPago é suficiente para pagar até esta parcela, retornar o valor da parcela
      if (valorPagoTotal >= valorPagoAteEstaParcela) {
        return valorParcelaMes;
      }
      
      // Se o valorPago é suficiente para pagar parcialmente esta parcela
      const valorPagoAteParcelaAnterior = valorPagoAteEstaParcela - valorParcelaMes;
      if (valorPagoTotal > valorPagoAteParcelaAnterior) {
        return valorPagoTotal - valorPagoAteParcelaAnterior;
      }
      
      // Parcela não foi paga
      return 0;
    }
    
    // Fallback: usar parcelasPagas (compatibilidade com dados antigos)
    const parcelasPagas = d.parcelasPagas || 0;
    
    // Se a parcela deste mês foi paga (idx < parcelasPagas), retornar valor da parcela
    if (idx < parcelasPagas) {
      return valorParcelaMes;
    }
    
    return 0;
  }
  
  // Para compras de cartão mapeadas como dívidas: usar valorPago
  if ((d.id && d.id.includes('purchase:')) || (d as any).cardId) {
    const valorPago = (d as any).valorPago || 0;
    const totalParcelas = d.parcelas || 1;
    const valorParcela = d.valorParcela || (d.valorTotal / totalParcelas);
    
    // Para o mês selecionado, calcular o valor devido da parcela deste mês
    // Usar startMonth se disponível, senão usar dataVencimento
    let startYM;
    if ((d as any).startMonth) {
      startYM = parseYYYYMM((d as any).startMonth);
    } else {
      startYM = parseYYYYMMDDtoYM(d.dataVencimento);
    }
    const selectedYM = parseYYYYMM(selectedMonth);
    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
    
    // Se não tem parcela neste mês, retornar 0
    if (idx < 0 || idx >= totalParcelas) {
      return 0;
    }
    
    // Calcular valor da parcela deste mês
    const base = valorParcela;
    const isLast = idx === totalParcelas - 1;
    const delta = Math.round(d.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
    const valorParcelaMes = base + (isLast ? delta / 100 : 0);
    
    // Calcular quanto foi pago até esta parcela (incluindo)
    let valorPagoAteEstaParcela = 0;
    for (let i = 0; i <= idx && i < totalParcelas; i++) {
      const isLastParcela = i === totalParcelas - 1;
      const valorParcelaI = base + (isLastParcela ? delta / 100 : 0);
      valorPagoAteEstaParcela += valorParcelaI;
    }
    
    // Se o valorPago é suficiente para pagar até esta parcela, retornar o valor da parcela
    if (valorPago >= valorPagoAteEstaParcela) {
      return valorParcelaMes;
    }
    
    // Se o valorPago é suficiente para pagar parcialmente esta parcela
    const valorPagoAteParcelaAnterior = valorPagoAteEstaParcela - valorParcelaMes;
    if (valorPago > valorPagoAteParcelaAnterior) {
      return valorPago - valorPagoAteParcelaAnterior;
    }
    
    // Parcela não foi paga
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
    const valorPagoAtual = c.valorPago || 0;
    
    // Verificar se esta compra tem parcela no mês selecionado
    const selectedYM = parseYYYYMM(selectedMonth);
    const [sy, sm] = c.startMonth.split('-').map(Number);
    const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(sy, sm);
    const temParcelaNoMes = idx >= 0 && idx < c.parcelas;
    
    // Se não tem parcela no mês, retornar dívida com valor 0 (será filtrada)
    if (!temParcelaNoMes) {
      return {
        id: `purchase:${c.id}`,
        descricao: `Cartão ${card?.nome || 'Desconhecido'}: ${c.descricao}`,
        valorTotal: 0,
        valorPago: 0,
        parcelasPagas: parcelasPagasAtualizadas,
        parcelas: c.parcelas,
        valorParcela: c.valorParcela,
        dataVencimento: `${anoSelecionado}-${String(mesSelecionado).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`,
        categoria: 'Cartão de Crédito',
        tipo: c.parcelas > 1 ? 'parcelada' : 'total',
        pago: false,
        cardId: c.cardId,
        startMonth: c.startMonth, // Preservar startMonth original
      } as any;
    }
    
    // Ajustar data de vencimento para o mês selecionado
    const dataVencimentoAjustada = `${anoSelecionado}-${String(mesSelecionado).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`;
    
    return {
      id: `purchase:${c.id}`,
      descricao: `Cartão ${card?.nome || 'Desconhecido'}: ${c.descricao}`,
      valorTotal: c.valorTotal, // Manter valorTotal completo para cálculo correto
      valorPago: valorPagoAtual, // Usar valorPago diretamente da compra
      parcelasPagas: parcelasPagasAtualizadas,
      parcelas: c.parcelas,
      valorParcela: c.valorParcela,
      dataVencimento: dataVencimentoAjustada,
      categoria: 'Cartão de Crédito',
      tipo: c.parcelas > 1 ? 'parcelada' : 'total',
      pago: false, // Adicionar campo pago para compatibilidade
      cardId: c.cardId, // Incluir cardId para referência
      startMonth: c.startMonth, // Preservar startMonth original para cálculo correto
    } as any;
  });
};

// Função para calcular restante do mês de um item individual
const getMonthlyRemaining = (d: Divida | CompraCartao, selectedMonth: string): number => {
  const valorDue = getMonthlyDue(d, selectedMonth);
  if (valorDue === 0) return 0;
  
  // Para compras de cartão e dívidas com valorPago, calcular baseado em valorPago e valorParcela
  const valorPagoTotal = (d as any).valorPago;
  const hasValorPago = valorPagoTotal !== undefined && valorPagoTotal !== null;
  
  if (hasValorPago) {
    // Para dívidas parceladas ou compras de cartão
    if (d.tipo === 'parcelada' && d.parcelas > 1) {
      const totalParcelas = d.parcelas || 1;
      const valorParcela = d.valorParcela || (d.valorTotal / totalParcelas);
      
      // Calcular índice da parcela do mês
      let startYM;
      if ((d as any).startMonth) {
        startYM = parseYYYYMM((d as any).startMonth);
      } else {
        startYM = parseYYYYMMDDtoYM(d.dataVencimento);
      }
      const selectedYM = parseYYYYMM(selectedMonth);
      const idx = ymToIndex(selectedYM.y, selectedYM.m) - ymToIndex(startYM.y, startYM.m);
      
      if (idx < 0 || idx >= totalParcelas) return 0;
      
      // Calcular valor da parcela deste mês
      const base = valorParcela;
      const isLast = idx === totalParcelas - 1;
      const delta = Math.round(d.valorTotal * 100) - Math.round(valorParcela * 100) * totalParcelas;
      const valorParcelaMes = base + (isLast ? delta / 100 : 0);
      
      // Calcular quanto foi pago até esta parcela (incluindo)
      let valorPagoAteEstaParcela = 0;
      for (let i = 0; i <= idx && i < totalParcelas; i++) {
        const isLastParcela = i === totalParcelas - 1;
        const valorParcelaI = base + (isLastParcela ? delta / 100 : 0);
        valorPagoAteEstaParcela += valorParcelaI;
      }
      
      // Calcular quanto foi pago desta parcela específica
      const valorPagoAteParcelaAnterior = valorPagoAteEstaParcela - valorParcelaMes;
      const valorPagoDestaParcela = Math.max(0, Math.min(valorParcelaMes, valorPagoTotal - valorPagoAteParcelaAnterior));
      
      // Restante = valor da parcela - valor pago desta parcela
      return Math.max(0, valorParcelaMes - valorPagoDestaParcela);
    }
    
    // Para dívidas à vista (tipo 'total')
    return Math.max(0, valorDue - Math.min(valorDue, valorPagoTotal));
  }
  
  // Fallback: se não tem valorPago, usar cálculo padrão
  return Math.max(0, valorDue);
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
  
  // Calcular restante do mês somando o restante de cada item individual
  // Isso garante que o cálculo seja baseado em valorPago e valorParcela de cada item
  const remainingDividas = dividas.reduce((sum, d) => sum + getMonthlyRemaining(d, selectedMonth), 0);
  const remainingPurchases = purchasesAsDividas.reduce((sum, d) => sum + getMonthlyRemaining(d, selectedMonth), 0);
  const monthlyRemaining = remainingDividas + remainingPurchases;
  
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

import { utils as XLSXUtils, writeFile as xlsxWriteFile, WorkBook } from 'xlsx';
import { Caixa, Transacao, Divida, ReceitaPrevista, CompraCartao, CartaoCredito, GastoFixo, Cofrinho } from '../App';

export interface ExportPayload {
  month: string; // YYYY-MM
  caixas: Caixa[];
  transacoes: Transacao[];
  dividas: Divida[];
  receitasPrevistas: ReceitaPrevista[];
  comprasCartao: CompraCartao[];
  cartoes: CartaoCredito[];
  gastosFixos: GastoFixo[];
  cofrinhos: Cofrinho[];
}

const parseYM = (ym: string) => ym.split('-').map(Number) as [number, number];

export function buildWorkbook(payload: ExportPayload) {
  const { month, caixas, transacoes, dividas, receitasPrevistas, comprasCartao, gastosFixos, cofrinhos } = payload;
  const [ano, mes] = parseYM(month);

  // Aba Caixa: valor inicial, somatório do extrato do mês e saldo final
  const caixasRows = caixas.map((caixa) => {
    const initMap = (caixa as any).initialByMonth || {};
    const inicial = initMap[month] ?? 0;
    const totalMes = transacoes
      .filter(t => t.caixaId === caixa.id)
      .filter(t => {
        const d = new Date(t.data + 'T00:00:00');
        return d.getFullYear() === ano && d.getMonth() === (mes - 1);
      })
      .reduce((s, t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    const final = inicial + totalMes;
    return {
      Caixa: caixa.nome,
      'Valor inicial': inicial,
      'Total do extrato (mês)': totalMes,
      'Saldo final (mês)': final,
      Tipo: caixa.tipo,
    };
  });

  const wsCaixas = XLSXUtils.json_to_sheet(caixasRows);

  // Aba Extrato: todas movimentações do mês
  const extratoRows = transacoes
    .filter(t => {
      const d = new Date(t.data + 'T00:00:00');
      return d.getFullYear() === ano && d.getMonth() === (mes - 1);
    })
    .map(t => ({
      Data: t.data,
      Hora: t.hora,
      Caixa: (caixas.find(c => c.id === t.caixaId)?.nome) || t.caixaId,
      Tipo: t.tipo,
      Valor: t.valor,
      Descrição: t.descricao,
      Categoria: t.categoria,
    }));
  const wsExtrato = XLSXUtils.json_to_sheet(extratoRows);

  // Aba Dívidas / Contas a pagar do mês selecionado
  // Critério: incluir dívidas com vencimento no mês ou movimentadas no mês
  const dividasRows = dividas.map(d => ({
    Descrição: d.descricao,
    'Valor total': d.valorTotal,
    'Valor pago': d.valorPago,
    Parcelas: d.parcelas,
    'Parcelas pagas': d.parcelasPagas,
    'Valor parcela': d.valorParcela,
    'Vencimento': d.dataVencimento,
    Tipo: d.tipo,
    Categoria: d.categoria || '',
  }));
  const wsDividas = XLSXUtils.json_to_sheet(dividasRows);

  // Outras abas relevantes: Receitas previstas e Compras de cartão
  const receitasRows = receitasPrevistas.map(r => ({
    Descrição: r.descricao,
    Valor: r.valor,
    'Vencimento': r.dataVencimento,
    Recebido: r.recebido ? 'Sim' : 'Não',
  }));
  const wsReceitas = XLSXUtils.json_to_sheet(receitasRows);

  const comprasRows = comprasCartao.map(p => ({
    Cartão: p.cardId,
    Descrição: p.descricao,
    'Valor total': p.valorTotal,
    Parcelas: p.parcelas,
    'Valor parcela': p.valorParcela,
    'Mês inicial': p.startMonth,
    'Data compra': p.dataCompra,
    'Parcelas pagas': p.parcelasPagas,
  }));
  const wsCompras = XLSXUtils.json_to_sheet(comprasRows);

  // Aba Dashboard (Resumo do mês)
  const entradas = transacoes.filter(t => {
    const d = new Date(t.data + 'T00:00:00');
    return d.getFullYear() === ano && d.getMonth() === (mes - 1) && t.tipo === 'entrada';
  }).reduce((s, t) => s + t.valor, 0);
  const saidas = transacoes.filter(t => {
    const d = new Date(t.data + 'T00:00:00');
    return d.getFullYear() === ano && d.getMonth() === (mes - 1) && t.tipo === 'saida';
  }).reduce((s, t) => s + t.valor, 0);
  const resumoRows = [{
    'Mês': month,
    'Entradas': entradas,
    'Saídas': saidas,
    'Saldo (Entradas - Saídas)': entradas - saidas,
    'Total Dívidas em Aberto': dividas.reduce((sum, d) => sum + (d.valorTotal - d.valorPago), 0),
  }];
  const wsResumo = XLSXUtils.json_to_sheet(resumoRows);

  // Aba Gastos Fixos
  const gastosRows = (gastosFixos || []).map(g => ({
    Descrição: g.descricao,
    Valor: g.valor,
    Categoria: g.categoria,
    'Dia vencimento': g.diaVencimento,
    Pago: g.pago ? 'Sim' : 'Não',
  }));
  const wsGastos = XLSXUtils.json_to_sheet(gastosRows);

  // Aba Cofrinhos
  const cofrinhosRows = (cofrinhos || []).map(c => ({
    Nome: c.nome,
    Tipo: c.tipo || 'manual',
    'Valor aplicado': c.valorAplicado ?? c.saldo,
    'Saldo (ou líquido)': c.saldo,
    'Data aplicação': c.dataAplicacao || '',
    '% CDI': c.percentualCDI ?? '',
  }));
  const wsCofrinhos = XLSXUtils.json_to_sheet(cofrinhosRows);

  const wb = XLSXUtils.book_new();
  XLSXUtils.book_append_sheet(wb, wsCaixas, 'Caixas');
  XLSXUtils.book_append_sheet(wb, wsExtrato, 'Extrato');
  XLSXUtils.book_append_sheet(wb, wsDividas, 'Dividas');
  XLSXUtils.book_append_sheet(wb, wsReceitas, 'Receitas');
  XLSXUtils.book_append_sheet(wb, wsCompras, 'ComprasCartao');
  XLSXUtils.book_append_sheet(wb, wsGastos, 'GastosFixos');
  XLSXUtils.book_append_sheet(wb, wsCofrinhos, 'Cofrinhos');
  XLSXUtils.book_append_sheet(wb, wsResumo, 'Dashboard');
  return wb;
}

export function downloadWorkbook(wb: WorkBook, fileName: string) {
  xlsxWriteFile(wb, fileName, { bookType: 'xlsx' });
}

export function exportMonthToXlsx(month: string, data: Omit<ExportPayload, 'month'>) {
  const wb = buildWorkbook({ month, ...data });
  const safe = month.replace(/\//g, '-');
  downloadWorkbook(wb, `export-${safe}.xlsx`);
}



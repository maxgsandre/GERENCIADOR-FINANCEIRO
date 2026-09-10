import { utils as XLSXUtils, writeFile as xlsxWriteFile, WorkBook, WorkSheet } from 'xlsx-js-style';
import { Caixa, Transacao, Divida, ReceitaPrevista, CompraCartao, CartaoCredito, GastoFixo, Cofrinho } from '../App';
import { getDividasDoMes, getMonthlyDue, parseYYYYMM, ymToIndex } from './monthlyCalculations';
import {
  caixaSaldoNoMes,
  initialForMonth,
  monthlyTotalFor,
  cofrinhoSaldo,
  cofrinhoRendimentoAcumulado,
  computeCdiRendimentoMensal,
  principalOf,
} from './cofrinhoCalculations';
import {
  COLORS,
  FMT,
  barraTexto,
  canvasStyle,
  cellStyle,
  emptyStyle,
  headerStyle,
  kpiLabelStyle,
  kpiValueStyle,
  nomeDoMes,
  noteStyle,
  sectionStyle,
  subtitleStyle,
  titleStyle,
  toExcelDate,
  totalStyle,
} from './xlsxStyles';

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

const ehDoMes = (dataISO: string, ano: number, mes: number) => {
  const d = new Date(dataISO + 'T00:00:00');
  return d.getFullYear() === ano && d.getMonth() === mes - 1;
};

/** Período (YYYY-MM) de um item que pode ter `periodo` ou só `dataVencimento`. */
const periodoDoItem = (item: { periodo?: string; dataVencimento?: string }): string | null => {
  if (item.periodo) return item.periodo;
  if (item.dataVencimento) {
    const d = new Date(item.dataVencimento + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Construtor genérico de abas em formato de tabela
// ---------------------------------------------------------------------------

type ColType = 'text' | 'money' | 'date' | 'int' | 'pct';

interface Col<T> {
  label: string;
  width: number;
  type?: ColType;
  align?: string;
  value: (row: T) => string | number | null;
  /** Soma a coluna na linha de TOTAL. */
  total?: boolean;
  /** Cor condicional do texto da célula. */
  color?: (row: T) => string | undefined;
}

const numFmtFor = (type?: ColType) => {
  switch (type) {
    case 'money': return FMT.money;
    case 'date': return FMT.date;
    case 'int': return FMT.int;
    case 'pct': return FMT.pct;
    default: return undefined;
  }
};

const alignFor = (type?: ColType, align?: string) => {
  if (align) return align;
  if (type === 'money' || type === 'int' || type === 'pct') return 'right';
  if (type === 'date') return 'center';
  return 'left';
};

const R_TITLE = 0;
const R_SUB = 1;
const R_HEAD = 3;
const R_FIRST = 4;

/**
 * Pinta de branco toda a área usada da aba. Sem isso o Excel mostra as próprias
 * linhas de grade nas células vazias e o relatório fica "quadriculado".
 */
const esconderGrade = (ws: WorkSheet, linhas: number, colunas: number) => {
  for (let r = 0; r < linhas; r++) {
    for (let c = 0; c < colunas; c++) {
      const addr = XLSXUtils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      if (!ws[addr].s) ws[addr].s = canvasStyle;
    }
  }
  ws['!ref'] = XLSXUtils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas - 1, c: colunas - 1 } });
};

function buildTable<T>(opts: {
  title: string;
  subtitle: string;
  cols: Col<T>[];
  rows: T[];
  totalLabel?: string;
  emptyMessage?: string;
  note?: string;
}): WorkSheet {
  const { title, subtitle, cols, rows, totalLabel = 'TOTAL', emptyMessage = 'Nenhum registro neste mês.', note } = opts;
  const n = cols.length;
  const temTotais = cols.some(c => c.total);

  const aoa: (string | number | null)[][] = [];
  aoa.push([title, ...Array(n - 1).fill(null)]);
  aoa.push([subtitle, ...Array(n - 1).fill(null)]);
  aoa.push(Array(n).fill(null));
  aoa.push(cols.map(c => c.label));

  if (rows.length === 0) {
    aoa.push([emptyMessage, ...Array(n - 1).fill(null)]);
  } else {
    rows.forEach(r => aoa.push(cols.map(c => c.value(r))));
  }

  const rTotal = R_FIRST + rows.length;
  if (temTotais && rows.length > 0) {
    aoa.push(cols.map((c, i) => {
      if (i === 0) return totalLabel;
      if (!c.total) return null;
      return rows.reduce((s, r) => s + (Number(c.value(r)) || 0), 0);
    }));
  }

  const rNote = aoa.length + 1;
  if (note) {
    aoa.push(Array(n).fill(null));
    aoa.push([note, ...Array(n - 1).fill(null)]);
  }

  const ws = XLSXUtils.aoa_to_sheet(aoa);
  const at = (r: number, c: number) => XLSXUtils.encode_cell({ r, c });
  const paint = (r: number, c: number, s: unknown) => {
    const addr = at(r, c);
    if (!ws[addr]) ws[addr] = { v: '', t: 's' };
    ws[addr].s = s;
  };

  // Faixa de título da aba
  for (let c = 0; c < n; c++) {
    paint(R_TITLE, c, titleStyle);
    paint(R_SUB, c, subtitleStyle);
  }

  // Linha de colunas. O botão do autofiltro fica na direita da célula e cobriria
  // o texto de um cabeçalho alinhado à direita, então esses ficam à esquerda.
  cols.forEach((col, c) => {
    const align = alignFor(col.type, col.align);
    paint(R_HEAD, c, headerStyle(align === 'right' ? 'left' : align));
  });

  // Corpo
  if (rows.length === 0) {
    paint(R_FIRST, 0, emptyStyle);
  } else {
    rows.forEach((row, i) => {
      const r = R_FIRST + i;
      const band = i % 2 === 1;
      cols.forEach((col, c) => paint(r, c, cellStyle({
        align: alignFor(col.type, col.align),
        numFmt: numFmtFor(col.type),
        band,
        color: col.color?.(row),
      })));
    });

    if (temTotais) {
      cols.forEach((col, c) => paint(rTotal, c, totalStyle({
        align: c === 0 ? 'left' : alignFor(col.type, col.align),
        numFmt: c === 0 ? undefined : numFmtFor(col.type),
      })));
    }
  }

  if (note) paint(rNote, 0, noteStyle);

  ws['!cols'] = cols.map(c => ({ wch: c.width }));
  ws['!merges'] = [
    { s: { r: R_TITLE, c: 0 }, e: { r: R_TITLE, c: n - 1 } },
    { s: { r: R_SUB, c: 0 }, e: { r: R_SUB, c: n - 1 } },
    ...(rows.length === 0 ? [{ s: { r: R_FIRST, c: 0 }, e: { r: R_FIRST, c: n - 1 } }] : []),
    ...(note ? [{ s: { r: rNote, c: 0 }, e: { r: rNote, c: n - 1 } }] : []),
  ];
  ws['!rows'] = [{ hpt: 30 }, { hpt: 17 }, { hpt: 6 }, { hpt: 24 }];
  if (rows.length > 0) {
    ws['!autofilter'] = { ref: `${at(R_HEAD, 0)}:${at(R_FIRST + rows.length - 1, n - 1)}` };
  }
  esconderGrade(ws, aoa.length, n);

  return ws;
}

// ---------------------------------------------------------------------------
// Aba Resumo (o dashboard em formato de relatório)
// ---------------------------------------------------------------------------

interface Kpi {
  label: string;
  valor: number;
  color?: string;
  /** Verde quando positivo, vermelho quando negativo. */
  sinal?: boolean;
  /** Formata como quantidade em vez de dinheiro. */
  contagem?: boolean;
}

function buildResumo(opts: {
  month: string;
  kpisPorSecao: { secao: string; kpis: Kpi[] }[];
  categorias: { nome: string; valor: number }[];
  note: string;
}): WorkSheet {
  const { month, kpisPorSecao, categorias, note } = opts;
  // A: espaçador | B: card | C: espaçador | D: card | E: espaçador | F: card | G: espaçador
  const NCOLS = 7;
  const COL_CARD = [1, 3, 5];

  const aoa: (string | number | null)[][] = [];
  const push = (row: (string | number | null)[] = []) => {
    aoa.push([...row, ...Array(Math.max(0, NCOLS - row.length)).fill(null)]);
    return aoa.length - 1;
  };

  const dois = (n: number) => String(n).padStart(2, '0');
  const agora = new Date();
  const carimbo = `${dois(agora.getDate())}/${dois(agora.getMonth() + 1)}/${agora.getFullYear()} às ${dois(agora.getHours())}:${dois(agora.getMinutes())}`;

  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const estilos: { r: number; c: number; s: unknown }[] = [];
  const alturas: Record<number, number> = {};

  const rTitle = push(['GERENCIADOR FINANCEIRO']);
  const rSub = push([`Resumo de ${nomeDoMes(month)}  ·  gerado em ${carimbo}`]);
  push();
  merges.push({ s: { r: rTitle, c: 0 }, e: { r: rTitle, c: NCOLS - 1 } });
  merges.push({ s: { r: rSub, c: 0 }, e: { r: rSub, c: NCOLS - 1 } });
  alturas[rTitle] = 34;
  alturas[rSub] = 18;

  // A faixa de seção é mesclada, mas cada célula sob ela precisa do estilo —
  // senão o fundo e a borda inferior param na primeira coluna.
  const pintarFaixaSecao = (r: number) => {
    for (let c = 1; c <= NCOLS - 2; c++) estilos.push({ r, c, s: sectionStyle });
  };

  kpisPorSecao.forEach(({ secao, kpis }) => {
    const rSec = push([null, secao]);
    merges.push({ s: { r: rSec, c: 1 }, e: { r: rSec, c: NCOLS - 2 } });
    pintarFaixaSecao(rSec);
    alturas[rSec] = 22;
    push();

    for (let i = 0; i < kpis.length; i += 3) {
      const linha = kpis.slice(i, i + 3);
      // Cada card ocupa uma coluna, separadas por uma coluna estreita vazia.
      const espalhar = (get: (k: Kpi) => string | number | null) =>
        linha.flatMap((k, j) => (j === 0 ? [get(k)] : [null, get(k)]));

      const rLabel = push([null, ...espalhar(k => k.label)]);
      const rValor = push([null, ...espalhar(k => k.valor)]);
      alturas[rLabel] = 16;
      alturas[rValor] = 26;

      linha.forEach((k, j) => {
        const c = COL_CARD[j];
        estilos.push({ r: rLabel, c, s: kpiLabelStyle });
        const cor = k.sinal ? (k.valor >= 0 ? COLORS.positive : COLORS.negative) : (k.color || COLORS.ink);
        estilos.push({ r: rValor, c, s: kpiValueStyle(cor, k.contagem ? FMT.int : FMT.money) });
      });
      push();
    }
  });

  // Ranking de categorias. Usa as mesmas três colunas largas dos cards
  // (B, D e F) para tudo ficar alinhado; as colunas estreitas são só espaço.
  const totalCategorias = categorias.reduce((s, c) => s + c.valor, 0);
  const rSecCat = push([null, 'GASTOS DO MÊS POR CATEGORIA']);
  merges.push({ s: { r: rSecCat, c: 1 }, e: { r: rSecCat, c: NCOLS - 2 } });
  pintarFaixaSecao(rSecCat);
  alturas[rSecCat] = 22;
  push();

  const linhaCat = (categoria: string | number | null, valor: string | number | null, part: string | number | null) =>
    push([null, categoria, null, valor, null, part]);

  const rHeadCat = linhaCat('Categoria', 'Valor', 'Participação no mês');
  [[1, 'left'], [3, 'right'], [5, 'left']].forEach(([c, align]) => {
    estilos.push({ r: rHeadCat, c: c as number, s: headerStyle(align as string) });
  });
  alturas[rHeadCat] = 22;

  if (categorias.length === 0) {
    const r = push([null, 'Nenhum gasto lançado neste mês.']);
    merges.push({ s: { r, c: 1 }, e: { r, c: NCOLS - 2 } });
    estilos.push({ r, c: 1, s: emptyStyle });
  } else {
    const maior = Math.max(...categorias.map(c => c.valor));
    const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;

    categorias.forEach((cat, i) => {
      const fracao = totalCategorias > 0 ? cat.valor / totalCategorias : 0;
      const barra = `${barraTexto(maior > 0 ? cat.valor / maior : 0)}  ${pct(fracao)}`;
      const r = linhaCat(cat.nome, cat.valor, barra);
      const band = i % 2 === 1;
      estilos.push({ r, c: 1, s: cellStyle({ band }) });
      estilos.push({ r, c: 3, s: cellStyle({ align: 'right', numFmt: FMT.money, band }) });
      estilos.push({ r, c: 5, s: cellStyle({ band, color: COLORS.brandSoft }) });
    });

    const rTot = linhaCat('TOTAL', totalCategorias, `${categorias.length} categorias`);
    estilos.push({ r: rTot, c: 1, s: totalStyle() });
    estilos.push({ r: rTot, c: 3, s: totalStyle({ align: 'right', numFmt: FMT.money }) });
    estilos.push({ r: rTot, c: 5, s: totalStyle() });
  }

  push();
  const rNote = push([null, note]);
  merges.push({ s: { r: rNote, c: 1 }, e: { r: rNote, c: NCOLS - 1 } });
  estilos.push({ r: rNote, c: 1, s: noteStyle });

  const ws = XLSXUtils.aoa_to_sheet(aoa);
  const at = (r: number, c: number) => XLSXUtils.encode_cell({ r, c });
  const paint = (r: number, c: number, s: unknown) => {
    const addr = at(r, c);
    if (!ws[addr]) ws[addr] = { v: '', t: 's' };
    ws[addr].s = s;
  };

  for (let c = 0; c < NCOLS; c++) {
    paint(rTitle, c, titleStyle);
    paint(rSub, c, subtitleStyle);
  }
  estilos.forEach(({ r, c, s }) => paint(r, c, s));

  ws['!cols'] = [{ wch: 2 }, { wch: 30 }, { wch: 2 }, { wch: 30 }, { wch: 2 }, { wch: 30 }, { wch: 2 }];
  ws['!merges'] = merges;
  ws['!rows'] = Array.from({ length: aoa.length }, (_, i) => ({ hpt: alturas[i] ?? 15 }));
  esconderGrade(ws, aoa.length, NCOLS);

  return ws;
}

// ---------------------------------------------------------------------------
// Workbook
// ---------------------------------------------------------------------------

export function buildWorkbook(payload: ExportPayload) {
  const { month, caixas, transacoes, dividas, receitasPrevistas, comprasCartao, cartoes, gastosFixos, cofrinhos } = payload;
  const [ano, mes] = parseYM(month);
  const rotuloMes = nomeDoMes(month);
  const nomeCaixa = (id: string) => caixas.find(c => c.id === id)?.nome || id;
  const nomeCartao = (id: string) => cartoes.find(c => c.id === id)?.nome || id;

  // ----- Dados do mês -----
  const transacoesMes = transacoes
    .filter(t => ehDoMes(t.data, ano, mes))
    .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));

  const entradasMes = transacoesMes
    .filter(t => t.tipo === 'entrada' && !(t as { ignorarDashboard?: boolean }).ignorarDashboard)
    .reduce((s, t) => s + t.valor, 0);
  const saidasMes = transacoesMes
    .filter(t => t.tipo === 'saida' && !(t as { ignorarDashboard?: boolean }).ignorarDashboard)
    .reduce((s, t) => s + t.valor, 0);

  const receitasMes = receitasPrevistas.filter(r => periodoDoItem(r) === month);
  const gastosFixosMes = gastosFixos.filter(g => periodoDoItem(g) === month);

  const dividasMes = getDividasDoMes(dividas, month);
  const parceladasMes = dividasMes.filter(d => d.tipo === 'parcelada');
  const esporadicasMes = dividasMes.filter(d => d.tipo === 'total');

  const { y: selY, m: selM } = parseYYYYMM(month);
  const parcelasCartaoMes = comprasCartao
    .map(c => {
      const [sy, sm] = c.startMonth.split('-').map(Number);
      const idx = ymToIndex(selY, selM) - ymToIndex(sy, sm);
      const total = c.parcelas || 1;
      if (idx < 0 || idx >= total) return null;
      if ((c.parcelasPagas || 0) >= total) return null;
      const base = c.valorParcela || c.valorTotal / total;
      const delta = Math.round(c.valorTotal * 100) - Math.round(base * 100) * total;
      const valorParcelaMes = base + (idx === total - 1 ? delta / 100 : 0);
      return { compra: c, idx, valorParcelaMes, paga: idx < (c.parcelasPagas || 0) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.compra.descricao.localeCompare(b.compra.descricao));

  const totalParceladas = parceladasMes.reduce((s, d) => s + getMonthlyDue(d, month), 0);
  const totalEsporadicas = esporadicasMes.reduce((s, d) => s + getMonthlyDue(d, month), 0);
  const totalCartaoMes = parcelasCartaoMes.reduce((s, p) => s + p.valorParcelaMes, 0);
  const totalGastosFixosMes = gastosFixosMes.reduce((s, g) => s + g.valor, 0);
  const totalReceitasMes = receitasMes.reduce((s, r) => s + r.valor, 0);
  const totalGastosMes = totalGastosFixosMes + totalParceladas + totalCartaoMes + totalEsporadicas;

  const totalEmCaixas = caixas.reduce((s, c) => s + caixaSaldoNoMes(c, month, transacoes), 0);
  const totalInvestido = cofrinhos.reduce((s, c) => s + cofrinhoSaldo(c), 0);
  const rendimentoAcumulado = cofrinhos.reduce((s, c) => s + cofrinhoRendimentoAcumulado(c), 0);

  // Dívidas em aberto: soma do que falta pagar em cada parcela ainda ativa, de
  // qualquer mês. Nunca usa valorTotal, que é repetido em todas as parcelas da
  // mesma dívida e por isso não pode ser somado linha a linha.
  const parcelasEmAberto = dividas
    .filter(d => !d.inativa)
    .map(d => {
      const devido = d.tipo === 'parcelada' ? (d.valorParcela || 0) : (d.valorTotal || 0);
      return { divida: d, falta: Math.max(0, devido - (d.valorPago || 0)) };
    })
    .filter(x => x.falta > 0.005);
  const totalEmAberto = parcelasEmAberto.reduce((s, x) => s + x.falta, 0);

  // ----- Aba Resumo -----
  const gastosPorCategoria: Record<string, number> = {};
  const somaCategoria = (categoria: string, valor: number) => {
    gastosPorCategoria[categoria] = (gastosPorCategoria[categoria] || 0) + valor;
  };
  gastosFixosMes.forEach(g => somaCategoria(g.categoria || 'Sem categoria', g.valor));
  esporadicasMes.forEach(d => somaCategoria(d.categoria || 'Esporádicos', getMonthlyDue(d, month)));
  parceladasMes.forEach(d => somaCategoria(d.categoria || 'Parcelados', getMonthlyDue(d, month)));
  if (totalCartaoMes > 0) somaCategoria('Cartão de Crédito', totalCartaoMes);

  const categorias = Object.entries(gastosPorCategoria)
    .map(([nome, valor]) => ({ nome, valor }))
    .filter(c => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const wsResumo = buildResumo({
    month,
    kpisPorSecao: [
      {
        secao: 'POSIÇÃO',
        kpis: [
          { label: 'TOTAL EM CAIXAS', valor: totalEmCaixas, sinal: true },
          { label: 'INVESTIDO (COFRINHOS)', valor: totalInvestido, color: COLORS.brand },
          { label: 'RENDIMENTO ACUMULADO', valor: rendimentoAcumulado, color: COLORS.positive },
        ],
      },
      {
        secao: `REALIZADO EM ${rotuloMes.toUpperCase()}`,
        kpis: [
          { label: 'ENTRADAS DO MÊS', valor: entradasMes, color: COLORS.positive },
          { label: 'SAÍDAS DO MÊS', valor: saidasMes, color: COLORS.negative },
          { label: 'BALANÇO DO MÊS', valor: entradasMes - saidasMes, sinal: true },
        ],
      },
      {
        secao: `PREVISTO PARA ${rotuloMes.toUpperCase()}`,
        kpis: [
          { label: 'RECEITAS PREVISTAS', valor: totalReceitasMes, color: COLORS.positive },
          { label: 'GASTOS FIXOS', valor: totalGastosFixosMes, color: COLORS.negative },
          { label: 'DÍVIDAS PARCELADAS', valor: totalParceladas, color: COLORS.negative },
          { label: 'PARCELAS DE CARTÃO', valor: totalCartaoMes, color: COLORS.negative },
          { label: 'DÍVIDAS ESPORÁDICAS', valor: totalEsporadicas, color: COLORS.negative },
          { label: 'GASTOS TOTAIS DO MÊS', valor: totalGastosMes, color: COLORS.negative },
        ],
      },
      {
        secao: 'PROJEÇÃO',
        kpis: [
          { label: 'DÉFICIT / SUPERÁVIT PREVISTO', valor: totalReceitasMes - totalGastosMes, sinal: true },
          { label: 'DÍVIDAS EM ABERTO (TOTAL)', valor: totalEmAberto, color: COLORS.warning },
          { label: 'PARCELAS EM ABERTO', valor: parcelasEmAberto.length, color: COLORS.warning, contagem: true },
        ],
      },
    ],
    categorias,
    note: 'Parcelas inativadas (de dívidas quitadas antecipadamente) não entram em nenhum número deste arquivo.',
  });

  // ----- Aba Extrato -----
  const wsExtrato = buildTable<Transacao>({
    title: 'EXTRATO DO MÊS',
    subtitle: `Movimentações lançadas em ${rotuloMes}`,
    cols: [
      { label: 'Data', width: 12, type: 'date', value: t => toExcelDate(t.data) },
      { label: 'Hora', width: 8, align: 'center', value: t => t.hora || '' },
      { label: 'Caixa', width: 22, value: t => nomeCaixa(t.caixaId) },
      { label: 'Tipo', width: 11, align: 'center', value: t => (t.tipo === 'entrada' ? 'Entrada' : 'Saída') },
      { label: 'Descrição', width: 42, value: t => t.descricao },
      { label: 'Categoria', width: 22, value: t => t.categoria || '' },
      {
        label: 'Entrada', width: 15, type: 'money', total: true,
        value: t => (t.tipo === 'entrada' ? t.valor : null),
        color: () => COLORS.positive,
      },
      {
        label: 'Saída', width: 15, type: 'money', total: true,
        value: t => (t.tipo === 'saida' ? t.valor : null),
        color: () => COLORS.negative,
      },
    ],
    rows: transacoesMes,
    emptyMessage: 'Nenhuma movimentação lançada neste mês.',
    note: 'Os totais desta aba incluem transações marcadas como "ignorar no dashboard".',
  });

  // ----- Aba Caixas -----
  const wsCaixas = buildTable<Caixa>({
    title: 'CAIXAS',
    subtitle: `Posição de cada caixa em ${rotuloMes}`,
    cols: [
      { label: 'Caixa', width: 28, value: c => c.nome },
      { label: 'Tipo', width: 18, align: 'center', value: c => c.tipo.replace('_', ' ') },
      { label: 'Saldo inicial', width: 16, type: 'money', total: true, value: c => initialForMonth(c, month, transacoes) },
      {
        label: 'Extrato do mês', width: 16, type: 'money', total: true,
        value: c => monthlyTotalFor(transacoes, c.id, ano, mes),
        color: c => (monthlyTotalFor(transacoes, c.id, ano, mes) >= 0 ? COLORS.positive : COLORS.negative),
      },
      { label: 'Saldo final', width: 16, type: 'money', total: true, value: c => caixaSaldoNoMes(c, month, transacoes) },
    ],
    rows: caixas,
    emptyMessage: 'Nenhum caixa cadastrado.',
  });

  // ----- Aba Receitas -----
  const wsReceitas = buildTable<ReceitaPrevista>({
    title: 'RECEITAS PREVISTAS',
    subtitle: `Receitas com competência em ${rotuloMes}`,
    cols: [
      { label: 'Descrição', width: 40, value: r => r.descricao },
      { label: 'Vencimento', width: 13, type: 'date', value: r => toExcelDate(r.dataVencimento) },
      { label: 'Caixa', width: 22, value: r => (r.caixaId ? nomeCaixa(r.caixaId) : '') },
      {
        label: 'Situação', width: 14, align: 'center',
        value: r => (r.recebido ? 'Recebido' : 'A receber'),
        color: r => (r.recebido ? COLORS.positive : COLORS.warning),
      },
      { label: 'Valor', width: 16, type: 'money', total: true, value: r => r.valor, color: () => COLORS.positive },
    ],
    rows: receitasMes,
    emptyMessage: 'Nenhuma receita prevista para este mês.',
  });

  // ----- Aba Gastos Fixos -----
  const wsGastos = buildTable<GastoFixo>({
    title: 'GASTOS FIXOS',
    subtitle: `Gastos fixos com competência em ${rotuloMes}`,
    cols: [
      { label: 'Descrição', width: 40, value: g => g.descricao },
      { label: 'Categoria', width: 24, value: g => g.categoria || '' },
      { label: 'Dia venc.', width: 11, type: 'int', value: g => g.diaVencimento ?? null },
      {
        label: 'Situação', width: 14, align: 'center',
        value: g => (g.pago ? 'Pago' : 'Em aberto'),
        color: g => (g.pago ? COLORS.positive : COLORS.warning),
      },
      { label: 'Valor pago', width: 16, type: 'money', total: true, value: g => g.valorPago ?? (g.pago ? g.valor : 0) },
      { label: 'Valor', width: 16, type: 'money', total: true, value: g => g.valor, color: () => COLORS.negative },
    ],
    rows: gastosFixosMes,
    emptyMessage: 'Nenhum gasto fixo neste mês.',
  });

  // ----- Aba Dívidas do mês -----
  interface LinhaDivida { d: Divida; devido: number }
  const linhasDividas: LinhaDivida[] = [...parceladasMes, ...esporadicasMes]
    .map(d => ({ d, devido: getMonthlyDue(d, month) }))
    .sort((a, b) => a.d.dataVencimento.localeCompare(b.d.dataVencimento));

  const situacaoDivida = (l: LinhaDivida) => {
    const pago = l.d.valorPago || 0;
    if (pago >= l.devido - 0.005) return 'Paga';
    return pago > 0 ? 'Parcial' : 'Em aberto';
  };

  const wsDividas = buildTable<LinhaDivida>({
    title: 'DÍVIDAS DO MÊS',
    subtitle: `Parcelas e gastos esporádicos com competência em ${rotuloMes}`,
    cols: [
      { label: 'Descrição', width: 40, value: l => l.d.descricao },
      { label: 'Categoria', width: 22, value: l => l.d.categoria || '' },
      { label: 'Tipo', width: 13, align: 'center', value: l => (l.d.tipo === 'parcelada' ? 'Parcelada' : 'Esporádica') },
      {
        label: 'Parcela', width: 11, align: 'center',
        value: l => (l.d.tipo === 'parcelada' ? `${l.d.parcelaIndex ?? '?'}/${l.d.parcelas}` : '—'),
      },
      { label: 'Vencimento', width: 13, type: 'date', value: l => toExcelDate(l.d.dataVencimento) },
      {
        label: 'Situação', width: 14, align: 'center',
        value: situacaoDivida,
        color: l => (situacaoDivida(l) === 'Paga' ? COLORS.positive : COLORS.warning),
      },
      { label: 'Pago', width: 15, type: 'money', total: true, value: l => Math.min(l.d.valorPago || 0, l.devido) },
      {
        label: 'Em aberto', width: 15, type: 'money', total: true,
        value: l => Math.max(0, l.devido - (l.d.valorPago || 0)),
        color: () => COLORS.warning,
      },
      { label: 'Valor do mês', width: 16, type: 'money', total: true, value: l => l.devido, color: () => COLORS.negative },
    ],
    rows: linhasDividas,
    emptyMessage: 'Nenhuma dívida com competência neste mês.',
    note: 'Parcelas de dívidas quitadas antecipadamente não aparecem nos meses seguintes à quitação.',
  });

  // ----- Aba Cartões -----
  type LinhaCartao = (typeof parcelasCartaoMes)[number];
  const wsCartoes = buildTable<LinhaCartao>({
    title: 'PARCELAS DE CARTÃO',
    subtitle: `Compras de cartão que caem na competência de ${rotuloMes}`,
    cols: [
      { label: 'Cartão', width: 20, value: p => nomeCartao(p.compra.cardId) },
      { label: 'Descrição', width: 38, value: p => p.compra.descricao },
      { label: 'Compra', width: 13, type: 'date', value: p => toExcelDate(p.compra.dataCompra) },
      { label: 'Parcela', width: 11, align: 'center', value: p => `${p.idx + 1}/${p.compra.parcelas}` },
      {
        label: 'Situação', width: 14, align: 'center',
        value: p => (p.paga ? 'Paga' : 'Em aberto'),
        color: p => (p.paga ? COLORS.positive : COLORS.warning),
      },
      { label: 'Valor da compra', width: 17, type: 'money', value: p => p.compra.valorTotal },
      { label: 'Parcela do mês', width: 16, type: 'money', total: true, value: p => p.valorParcelaMes, color: () => COLORS.negative },
    ],
    rows: parcelasCartaoMes,
    emptyMessage: 'Nenhuma parcela de cartão neste mês.',
    note: '"Valor da compra" é o total da compra e por isso não é somado — some apenas a coluna "Parcela do mês".',
  });

  // ----- Aba Dívidas em aberto -----
  const wsAberto = buildTable<{ divida: Divida; falta: number }>({
    title: 'DÍVIDAS EM ABERTO',
    subtitle: 'Todas as parcelas ainda não quitadas, de qualquer mês',
    cols: [
      { label: 'Descrição', width: 40, value: l => l.divida.descricao },
      { label: 'Categoria', width: 22, value: l => l.divida.categoria || '' },
      { label: 'Competência', width: 14, align: 'center', value: l => l.divida.periodo || '' },
      {
        label: 'Parcela', width: 11, align: 'center',
        value: l => (l.divida.tipo === 'parcelada' ? `${l.divida.parcelaIndex ?? '?'}/${l.divida.parcelas}` : '—'),
      },
      { label: 'Vencimento', width: 13, type: 'date', value: l => toExcelDate(l.divida.dataVencimento) },
      { label: 'Em aberto', width: 16, type: 'money', total: true, value: l => l.falta, color: () => COLORS.warning },
    ],
    rows: parcelasEmAberto
      .slice()
      .sort((a, b) => (a.divida.periodo || '').localeCompare(b.divida.periodo || '')),
    emptyMessage: 'Nenhuma parcela em aberto.',
    note: 'Cada linha é uma parcela. O total é o quanto ainda falta pagar — não o valor original das dívidas.',
  });

  // ----- Aba Cofrinhos -----
  const wsCofrinhos = buildTable<Cofrinho>({
    title: 'COFRINHOS',
    subtitle: 'Posição atual dos investimentos (rendimento calculado até hoje)',
    cols: [
      { label: 'Nome', width: 28, value: c => c.nome },
      { label: 'Tipo', width: 12, align: 'center', value: c => (c.tipo === 'cdi' ? 'CDI' : 'Manual') },
      { label: '% CDI', width: 10, align: 'right', value: c => (c.tipo === 'cdi' ? (c.percentualCDI ?? null) : null) },
      { label: 'Aplicação', width: 13, type: 'date', value: c => toExcelDate(c.dataAplicacao) },
      { label: 'Aplicado', width: 16, type: 'money', total: true, value: c => principalOf(c) },
      {
        label: 'Rendimento', width: 16, type: 'money', total: true,
        value: c => cofrinhoRendimentoAcumulado(c), color: () => COLORS.positive,
      },
      {
        label: 'Rend. mensal aprox.', width: 19, type: 'money', total: true,
        value: c => (c.tipo === 'cdi' ? computeCdiRendimentoMensal(c) : (c.rendimentoMensal || 0)),
      },
      { label: 'Saldo atual', width: 17, type: 'money', total: true, value: c => cofrinhoSaldo(c) },
    ],
    rows: cofrinhos,
    emptyMessage: 'Nenhum cofrinho cadastrado.',
  });

  const wb: WorkBook = XLSXUtils.book_new();
  XLSXUtils.book_append_sheet(wb, wsResumo, 'Resumo');
  XLSXUtils.book_append_sheet(wb, wsExtrato, 'Extrato');
  XLSXUtils.book_append_sheet(wb, wsCaixas, 'Caixas');
  XLSXUtils.book_append_sheet(wb, wsReceitas, 'Receitas');
  XLSXUtils.book_append_sheet(wb, wsGastos, 'Gastos Fixos');
  XLSXUtils.book_append_sheet(wb, wsDividas, 'Dividas do Mes');
  XLSXUtils.book_append_sheet(wb, wsCartoes, 'Cartoes');
  XLSXUtils.book_append_sheet(wb, wsAberto, 'Dividas em Aberto');
  XLSXUtils.book_append_sheet(wb, wsCofrinhos, 'Cofrinhos');

  wb.Props = {
    Title: `Gerenciador Financeiro — ${rotuloMes}`,
    Subject: 'Resumo financeiro mensal',
    Author: 'Gerenciador Financeiro',
  };

  return wb;
}

export function downloadWorkbook(wb: WorkBook, fileName: string) {
  xlsxWriteFile(wb, fileName, { bookType: 'xlsx', cellStyles: true });
}

export function exportMonthToXlsx(month: string, data: Omit<ExportPayload, 'month'>) {
  const wb = buildWorkbook({ month, ...data });
  const safe = month.replace(/\//g, '-');
  downloadWorkbook(wb, `financeiro-${safe}.xlsx`);
}

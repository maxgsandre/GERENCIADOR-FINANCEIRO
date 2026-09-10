/**
 * Paleta, formatos e helpers de estilo usados na exportação para Excel.
 * A biblioteca `xlsx-js-style` aceita um objeto `s` por célula com
 * font / fill / border / alignment / numFmt.
 */

export const COLORS = {
  brand: '1E3A5F',
  brandSoft: '2F5D8C',
  section: 'E8EEF6',
  band: 'F5F8FC',
  line: 'DCE3EC',
  lineSoft: 'EEF1F5',
  ink: '1F2937',
  muted: '6B7280',
  positive: '15803D',
  negative: 'B91C1C',
  warning: 'B45309',
  cardLabel: '5B6B7F',
  white: 'FFFFFF',
} as const;

export const FMT = {
  money: 'R$ #,##0.00;[Red]-R$ #,##0.00',
  moneyPlain: 'R$ #,##0.00',
  date: 'dd/mm/yyyy',
  int: '#,##0',
  pct: '0.0%',
} as const;

const FONT = 'Calibri';

type BorderSide = { style: string; color: { rgb: string } };

export const thin = (rgb: string = COLORS.line): BorderSide => ({ style: 'thin', color: { rgb } });

export const boxBorder = (rgb: string = COLORS.line) => ({
  top: thin(rgb),
  bottom: thin(rgb),
  left: thin(rgb),
  right: thin(rgb),
});

/** Converte 'YYYY-MM-DD' no serial de data do Excel (sem sofrer com fuso). */
export const toExcelDate = (iso?: string): number | null => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const nomeDoMes = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES[(m || 1) - 1]} de ${y}`;
};

// ---------- Estilos prontos ----------

export const titleStyle = {
  font: { name: FONT, sz: 16, bold: true, color: { rgb: COLORS.white } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.brand } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
};

export const subtitleStyle = {
  font: { name: FONT, sz: 10, italic: true, color: { rgb: COLORS.white } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.brandSoft } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
};

export const sectionStyle = {
  font: { name: FONT, sz: 11, bold: true, color: { rgb: COLORS.brand } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.section } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  border: { bottom: thin(COLORS.brandSoft) },
};

export const headerStyle = (align: string = 'left') => ({
  font: { name: FONT, sz: 10, bold: true, color: { rgb: COLORS.white } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.brandSoft } },
  alignment: { horizontal: align, vertical: 'center', wrapText: true, indent: align === 'left' ? 1 : 0 },
  border: boxBorder(COLORS.brandSoft),
});

export const cellStyle = (opts: {
  align?: string;
  numFmt?: string;
  band?: boolean;
  bold?: boolean;
  color?: string;
  italic?: boolean;
} = {}) => ({
  font: {
    name: FONT,
    sz: 10,
    bold: !!opts.bold,
    italic: !!opts.italic,
    color: { rgb: opts.color || COLORS.ink },
  },
  fill: { patternType: 'solid', fgColor: { rgb: opts.band ? COLORS.band : COLORS.white } },
  alignment: {
    horizontal: opts.align || 'left',
    vertical: 'center',
    indent: (opts.align || 'left') === 'left' ? 1 : 0,
  },
  border: boxBorder(COLORS.lineSoft),
  ...(opts.numFmt ? { numFmt: opts.numFmt } : {}),
});

export const totalStyle = (opts: { align?: string; numFmt?: string; color?: string } = {}) => ({
  font: { name: FONT, sz: 10, bold: true, color: { rgb: opts.color || COLORS.brand } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.section } },
  alignment: {
    horizontal: opts.align || 'left',
    vertical: 'center',
    indent: (opts.align || 'left') === 'left' ? 1 : 0,
  },
  border: { top: thin(COLORS.brandSoft), bottom: thin(COLORS.brandSoft) },
  ...(opts.numFmt ? { numFmt: opts.numFmt } : {}),
});

export const kpiLabelStyle = {
  font: { name: FONT, sz: 9, bold: true, color: { rgb: COLORS.cardLabel } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.band } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  border: { top: thin(), left: thin(), right: thin() },
};

export const kpiValueStyle = (color: string = COLORS.ink, numFmt: string = FMT.money) => ({
  font: { name: FONT, sz: 14, bold: true, color: { rgb: color } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.band } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  border: { bottom: thin(), left: thin(), right: thin() },
  numFmt,
});

export const noteStyle = {
  font: { name: FONT, sz: 9, italic: true, color: { rgb: COLORS.muted } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
};

export const emptyStyle = {
  font: { name: FONT, sz: 10, italic: true, color: { rgb: COLORS.muted } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

/** Fundo branco liso, usado para esconder as linhas de grade do Excel. */
export const canvasStyle = {
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.white } },
};

/** Barra proporcional em texto, usada no ranking de categorias. */
export const barraTexto = (fracao: number, largura = 18): string => {
  const preenchido = Math.max(0, Math.min(largura, Math.round(fracao * largura)));
  return '█'.repeat(preenchido) + '░'.repeat(largura - preenchido);
};

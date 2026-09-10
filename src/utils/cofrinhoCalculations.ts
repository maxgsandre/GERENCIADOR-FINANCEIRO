import { Caixa, Cofrinho, Transacao } from '../App';

const ymToIndex = (y: number, m: number) => y * 12 + (m - 1);
const parseYM = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return { y, m };
};
const nextYM = (y: number, m: number) => ({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1 });

/**
 * Soma das movimentações de um caixa dentro de um mês (entradas - saídas).
 */
export const monthlyTotalFor = (
  transacoes: Transacao[],
  caixaId: string,
  y: number,
  m: number
): number =>
  transacoes
    .filter(t => t.caixaId === caixaId)
    .filter(t => {
      const d = new Date(t.data + 'T00:00:00');
      return d.getFullYear() === y && d.getMonth() === (m - 1);
    })
    .reduce((s, t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);

/**
 * Valor inicial de um caixa no mês. Quando o mês não tem valor inicial cadastrado,
 * propaga o último valor conhecido somando os extratos dos meses intermediários.
 */
export const initialForMonth = (
  caixa: Caixa,
  ym: string,
  transacoes: Transacao[]
): number => {
  const init = caixa.initialByMonth;
  if (init && Object.prototype.hasOwnProperty.call(init, ym)) {
    return init[ym] ?? 0;
  }
  if (!init) return 0;

  const { y: tgtY, m: tgtM } = parseYM(ym);
  let bestKey: string | null = null;
  Object.keys(init).forEach(k => {
    const { y, m } = parseYM(k);
    if (ymToIndex(y, m) <= ymToIndex(tgtY, tgtM)) {
      if (bestKey === null) {
        bestKey = k;
      } else {
        const { y: by, m: bm } = parseYM(bestKey);
        if (ymToIndex(y, m) > ymToIndex(by, bm)) bestKey = k;
      }
    }
  });
  if (!bestKey) return 0;

  const { y: sy, m: sm } = parseYM(bestKey);
  let current = init[bestKey] ?? 0;
  let cy = sy;
  let cm = sm;
  while (!(cy === tgtY && cm === tgtM)) {
    current += monthlyTotalFor(transacoes, caixa.id, cy, cm);
    const n = nextYM(cy, cm);
    cy = n.y;
    cm = n.m;
  }
  return current;
};

/**
 * Saldo de um caixa no mês (inicial + extrato do mês).
 */
export const caixaSaldoNoMes = (caixa: Caixa, ym: string, transacoes: Transacao[]): number => {
  const { y, m } = parseYM(ym);
  return initialForMonth(caixa, ym, transacoes) + monthlyTotalFor(transacoes, caixa.id, y, m);
};

// ---------- Cofrinhos (CDI) ----------

export const CDI_ANUAL_PERCENT = 10.75;

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
  if (daysSince <= 360) return 0.2;
  if (daysSince <= 720) return 0.175;
  return 0.15;
};

export const principalOf = (c: Cofrinho): number =>
  (c.valorAplicado || 0) + (c.aportes || []).reduce((s, a) => s + a.valor, 0);

export const computeCdiSaldoLiquido = (c: Cofrinho): number => {
  const percentOfCDI = c.percentualCDI || 0;
  const baseDaily = dailyRateFromAnnual(CDI_ANUAL_PERCENT);
  const daily = baseDaily * (percentOfCDI / 100);
  const todayStr = new Date().toISOString().slice(0, 10);
  const aportes = [
    ...(c.valorAplicado && c.dataAplicacao ? [{ data: c.dataAplicacao, valor: c.valorAplicado }] : []),
    ...(c.aportes || []),
  ];
  const principal = principalOf(c);
  let rendimentoBruto = 0;
  let totalIR = 0;
  let totalIOF = 0;
  for (const ap of aportes) {
    const nBiz = approxBusinessDays(ap.data, todayStr);
    const fator = Math.pow(1 + daily, nBiz);
    const rendBrutoAp = ap.valor * (fator - 1);
    const daysSince = Math.max(
      0,
      Math.floor((new Date(todayStr).getTime() - new Date(ap.data).getTime()) / 86400000)
    );
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

export const computeCdiRendimentoMensal = (c: Cofrinho): number => {
  const percentOfCDI = c.percentualCDI || 0;
  const annual = (percentOfCDI / 100) * CDI_ANUAL_PERCENT; // % a.a.
  return (principalOf(c) * annual) / 12 / 100; // R$ por mês (aprox.)
};

/** Saldo do cofrinho já com rendimentos (líquido, quando CDI). */
export const cofrinhoSaldo = (c: Cofrinho): number =>
  c.tipo === 'cdi' ? computeCdiSaldoLiquido(c) : c.saldo;

/** Rendimento acumulado desde a aplicação. */
export const cofrinhoRendimentoAcumulado = (c: Cofrinho): number =>
  Math.max(0, cofrinhoSaldo(c) - principalOf(c));

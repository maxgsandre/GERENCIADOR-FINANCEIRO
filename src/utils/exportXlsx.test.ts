import { utils as XLSXUtils } from 'xlsx-js-style';
import { describe, expect, it } from 'vitest';

import { Divida } from '../App';
import { buildWorkbook, ExportPayload } from './exportXlsx';

const parcela = (periodo: string, over: Partial<Divida> = {}): Divida => ({
  id: `fin-${periodo}`,
  descricao: 'Financiamento Carro',
  // valorTotal e o total da divida inteira, repetido em TODAS as parcelas.
  valorTotal: 23036.16,
  valorPago: 0,
  parcelas: 48,
  parcelasPagas: 0,
  valorParcela: 479.92,
  dataVencimento: `${periodo}-20`,
  tipo: 'parcelada',
  categoria: 'Transporte',
  periodo,
  ...over,
});

const payload = (over: Partial<ExportPayload> = {}): ExportPayload => ({
  month: '2026-09',
  caixas: [],
  transacoes: [],
  dividas: [],
  receitasPrevistas: [],
  comprasCartao: [],
  cartoes: [],
  gastosFixos: [],
  cofrinhos: [],
  ...over,
});

/** Lê o valor do card logo abaixo do rótulo informado, na aba Resumo. */
const kpi = (wb: ReturnType<typeof buildWorkbook>, rotulo: string): number => {
  const ws = wb.Sheets['Resumo'];
  const range = XLSXUtils.decode_range(ws['!ref'] as string);

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (ws[XLSXUtils.encode_cell({ r, c })]?.v === rotulo) {
        return Number(ws[XLSXUtils.encode_cell({ r: r + 1, c })]?.v ?? NaN);
      }
    }
  }
  throw new Error(`Card "${rotulo}" não encontrado na aba Resumo`);
};

/**
 * Linhas de dados de uma aba de tabela. O layout é fixo: título, subtítulo,
 * espaçador e cabeçalho ocupam as quatro primeiras linhas; os dados vão até a
 * linha de TOTAL (ou até a primeira linha vazia, quando não há totais).
 */
const linhas = (wb: ReturnType<typeof buildWorkbook>, aba: string): unknown[][] => {
  const todas = XLSXUtils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, blankrows: true });
  const dados: unknown[][] = [];

  for (const linha of todas.slice(4)) {
    const primeira = linha?.[0];
    if (primeira === 'TOTAL' || primeira === '' || primeira == null) break;
    dados.push(linha);
  }
  return dados;
};

describe('buildWorkbook', () => {
  it('cria todas as abas esperadas', () => {
    expect(buildWorkbook(payload()).SheetNames).toEqual([
      'Resumo',
      'Extrato',
      'Caixas',
      'Receitas',
      'Gastos Fixos',
      'Dividas do Mes',
      'Cartoes',
      'Dividas em Aberto',
      'Cofrinhos',
    ]);
  });

  it('gera o arquivo mesmo sem nenhum dado', () => {
    const wb = buildWorkbook(payload());

    expect(kpi(wb, 'GASTOS TOTAIS DO MÊS')).toBe(0);
    expect(kpi(wb, 'DÍVIDAS EM ABERTO (TOTAL)')).toBe(0);
  });
});

describe('total de dívidas em aberto', () => {
  it('soma a parcela, nunca o valor total da dívida', () => {
    // Regressão: a versão antiga somava valorTotal de cada linha e contava a
    // dívida inteira uma vez por parcela — 3 parcelas davam R$ 69.108,48.
    const wb = buildWorkbook(
      payload({ dividas: [parcela('2026-09'), parcela('2026-10'), parcela('2026-11')] })
    );

    expect(kpi(wb, 'DÍVIDAS EM ABERTO (TOTAL)')).toBeCloseTo(479.92 * 3, 2);
  });

  it('desconta o que já foi pago em cada parcela', () => {
    const wb = buildWorkbook(
      payload({
        dividas: [parcela('2026-09', { valorPago: 479.92 }), parcela('2026-10', { valorPago: 100 })],
      })
    );

    expect(kpi(wb, 'DÍVIDAS EM ABERTO (TOTAL)')).toBeCloseTo(379.92, 2);
  });

  it('não conta parcelas inativas', () => {
    const wb = buildWorkbook(
      payload({ dividas: [parcela('2026-09'), parcela('2026-10', { inativa: true })] })
    );

    expect(kpi(wb, 'DÍVIDAS EM ABERTO (TOTAL)')).toBeCloseTo(479.92, 2);
  });
});

describe('parcelas inativas', () => {
  const dividas = [
    parcela('2026-09', { id: 'ativa', descricao: 'Cassio Carro', valorParcela: 587.5 }),
    parcela('2026-09', { id: 'morta', inativa: true }),
  ];

  it('ficam fora do total de dívidas parceladas do mês', () => {
    const wb = buildWorkbook(payload({ dividas }));

    expect(kpi(wb, 'DÍVIDAS PARCELADAS')).toBe(587.5);
  });

  it('não aparecem como linha na aba de dívidas do mês', () => {
    const wb = buildWorkbook(payload({ dividas }));
    const descricoes = linhas(wb, 'Dividas do Mes').map((l) => l[0]);

    expect(descricoes).toEqual(['Cassio Carro']);
  });

  it('não aparecem na aba de dívidas em aberto', () => {
    const wb = buildWorkbook(payload({ dividas }));

    expect(linhas(wb, 'Dividas em Aberto')).toHaveLength(1);
  });
});

describe('competência do mês', () => {
  it('exporta apenas o mês pedido', () => {
    const wb = buildWorkbook(
      payload({ month: '2026-09', dividas: [parcela('2026-08'), parcela('2026-09'), parcela('2026-10')] })
    );

    expect(linhas(wb, 'Dividas do Mes')).toHaveLength(1);
    expect(kpi(wb, 'DÍVIDAS PARCELADAS')).toBe(479.92);
  });

  it('lista todas as competências na aba de dívidas em aberto', () => {
    const wb = buildWorkbook(
      payload({ month: '2026-09', dividas: [parcela('2026-08'), parcela('2026-09'), parcela('2026-10')] })
    );

    expect(linhas(wb, 'Dividas em Aberto')).toHaveLength(3);
  });
});

describe('gastos totais do mês', () => {
  it('somam fixos, parceladas e esporádicas', () => {
    const wb = buildWorkbook(
      payload({
        gastosFixos: [
          {
            id: 'g1',
            descricao: 'Aluguel',
            valor: 1000,
            categoria: 'Moradia',
            diaVencimento: 10,
            pago: false,
            periodo: '2026-09',
          },
        ],
        dividas: [
          parcela('2026-09'),
          {
            ...parcela('2026-09'),
            id: 'esporadica',
            tipo: 'total',
            parcelas: 1,
            valorTotal: 50,
            valorParcela: 50,
          },
        ],
      })
    );

    expect(kpi(wb, 'GASTOS TOTAIS DO MÊS')).toBeCloseTo(1000 + 479.92 + 50, 2);
  });
});

import { describe, expect, it } from 'vitest';

import { Divida } from '../App';
import {
  getDividasDoMes,
  getMonthlyDue,
  parseYYYYMM,
  parseYYYYMMDDtoYM,
  ymToIndex,
} from './monthlyCalculations';

/** Monta uma divida completa a partir dos campos que importam para cada teste. */
const divida = (over: Partial<Divida> = {}): Divida => ({
  id: 'd1',
  descricao: 'Divida de teste',
  valorTotal: 100,
  valorPago: 0,
  parcelas: 1,
  parcelasPagas: 0,
  valorParcela: 100,
  dataVencimento: '2026-09-10',
  tipo: 'total',
  ...over,
});

/** Uma parcela da estrutura nova: um documento por competencia. */
const parcela = (periodo: string, over: Partial<Divida> = {}): Divida =>
  divida({
    tipo: 'parcelada',
    parcelas: 48,
    valorTotal: 23036.16,
    valorParcela: 479.92,
    periodo,
    dataVencimento: `${periodo}-20`,
    ...over,
  });

describe('getDividasDoMes', () => {
  it('ignora parcelas inativas', () => {
    // Este e exatamente o caso que inflava o Dashboard: ao quitar uma divida
    // antecipadamente as parcelas futuras ganham inativa: true, continuam no
    // banco e sumem da aba de Dividas -- mas eram somadas no Dashboard.
    const dividas = [
      parcela('2026-09', { id: 'ativa', descricao: 'Cassio Carro', valorParcela: 587.5 }),
      parcela('2026-09', { id: 'morta', descricao: 'Financiamento Carro', inativa: true }),
    ];

    const resultado = getDividasDoMes(dividas, '2026-09');

    expect(resultado.map((d) => d.id)).toEqual(['ativa']);
  });

  it('seleciona pelo periodo quando ele existe', () => {
    const dividas = [parcela('2026-08'), parcela('2026-09'), parcela('2026-10')];

    expect(getDividasDoMes(dividas, '2026-09')).toHaveLength(1);
    expect(getDividasDoMes(dividas, '2026-09')[0].periodo).toBe('2026-09');
  });

  it('nao usa a dataVencimento quando o periodo diz outra coisa', () => {
    // O vencimento pode cair em outro mes sem mudar a competencia do lancamento.
    const d = parcela('2026-09', { dataVencimento: '2026-10-05' });

    expect(getDividasDoMes([d], '2026-09')).toHaveLength(1);
    expect(getDividasDoMes([d], '2026-10')).toHaveLength(0);
  });

  it('devolve lista vazia quando nenhum lancamento e do mes', () => {
    expect(getDividasDoMes([parcela('2026-08')], '2026-09')).toEqual([]);
  });

  describe('compatibilidade com dividas antigas, sem periodo', () => {
    it('espalha uma parcelada pelos meses a partir do vencimento', () => {
      const antiga = divida({
        tipo: 'parcelada',
        parcelas: 3,
        valorTotal: 300,
        valorParcela: 100,
        dataVencimento: '2026-09-10',
        periodo: undefined,
      });

      expect(getDividasDoMes([antiga], '2026-08')).toHaveLength(0);
      expect(getDividasDoMes([antiga], '2026-09')).toHaveLength(1);
      expect(getDividasDoMes([antiga], '2026-11')).toHaveLength(1);
      expect(getDividasDoMes([antiga], '2026-12')).toHaveLength(0);
    });

    it('coloca uma esporadica apenas no mes do vencimento', () => {
      const antiga = divida({ dataVencimento: '2026-09-10', periodo: undefined });

      expect(getDividasDoMes([antiga], '2026-09')).toHaveLength(1);
      expect(getDividasDoMes([antiga], '2026-10')).toHaveLength(0);
    });

    it('ignora inativas tambem no caminho antigo', () => {
      const antiga = divida({ dataVencimento: '2026-09-10', periodo: undefined, inativa: true });

      expect(getDividasDoMes([antiga], '2026-09')).toEqual([]);
    });
  });
});

describe('getMonthlyDue', () => {
  it('usa valorParcela para parcelada e valorTotal para esporadica', () => {
    expect(getMonthlyDue(parcela('2026-09'), '2026-09')).toBe(479.92);
    expect(getMonthlyDue(divida({ periodo: '2026-09', valorTotal: 42 }), '2026-09')).toBe(42);
  });

  it('nunca cobra o valor cheio da divida numa unica parcela', () => {
    // valorTotal e repetido em todas as parcelas; somar esse campo linha a linha
    // foi o que fez o "Total em Aberto" do Excel chegar a R$ 841 mil.
    const p = parcela('2026-09');

    expect(getMonthlyDue(p, '2026-09')).toBeLessThan(p.valorTotal);
  });

  it('devolve zero fora da competencia', () => {
    expect(getMonthlyDue(parcela('2026-09'), '2026-10')).toBe(0);
  });

  describe('ajuste de centavos na ultima parcela, sem periodo', () => {
    const quebrada = divida({
      tipo: 'parcelada',
      parcelas: 3,
      valorTotal: 100,
      valorParcela: 33.33,
      dataVencimento: '2026-09-10',
      periodo: undefined,
    });

    it('cobra o valor base nas parcelas intermediarias', () => {
      expect(getMonthlyDue(quebrada, '2026-09')).toBe(33.33);
      expect(getMonthlyDue(quebrada, '2026-10')).toBe(33.33);
    });

    it('joga a sobra na ultima parcela', () => {
      expect(getMonthlyDue(quebrada, '2026-11')).toBeCloseTo(33.34, 2);
    });

    it('faz as parcelas somarem exatamente o total', () => {
      const soma = ['2026-09', '2026-10', '2026-11'].reduce(
        (s, mes) => s + getMonthlyDue(quebrada, mes),
        0
      );

      expect(soma).toBeCloseTo(100, 2);
    });
  });
});

describe('helpers de data', () => {
  it('converte YYYY-MM sem depender do fuso', () => {
    expect(parseYYYYMM('2026-09')).toEqual({ y: 2026, m: 9 });
  });

  it('le o primeiro dia do mes como o proprio mes', () => {
    // new Date('2026-09-01') seria meia-noite UTC e, em Brasilia, 31/08.
    expect(parseYYYYMMDDtoYM('2026-09-01')).toEqual({ y: 2026, m: 9 });
  });

  it('le o ultimo dia do mes como o proprio mes', () => {
    expect(parseYYYYMMDDtoYM('2026-09-30')).toEqual({ y: 2026, m: 9 });
  });

  it('ordena meses atravessando a virada do ano', () => {
    expect(ymToIndex(2027, 1) - ymToIndex(2026, 12)).toBe(1);
    expect(ymToIndex(2026, 12) - ymToIndex(2026, 1)).toBe(11);
  });
});

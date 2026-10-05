import { describe, expect, it } from 'vitest';

import { parseYYYYMMDDtoYM } from './monthlyCalculations';
import { toExcelDate } from './xlsxStyles';

/**
 * O projeto guarda datas como texto `YYYY-MM-DD` e opera no fuso de Brasília.
 * Estes testes travam a convenção: toda leitura dessas datas precisa ser local,
 * nunca UTC. A suíte roda com TZ=America/Sao_Paulo (ver vitest.config.ts).
 */

describe('a armadilha que torna a convenção necessária', () => {
  it('o fuso da suíte é o de operação', () => {
    // Se isto falhar, os testes abaixo não provam nada.
    expect(new Date('2026-09-05T12:00:00').getTimezoneOffset()).toBe(180); // UTC-3
  });

  it('new Date sem hora volta um dia, porque é lido como UTC', () => {
    // Esta é a causa de "Vencimento: 04/09/2026" para um lançamento do dia 05.
    expect(new Date('2026-09-05').getDate()).toBe(4);
  });

  it('new Date com T00:00:00 mantém o dia', () => {
    // A forma correta, já usada na ordenação e nos cálculos.
    expect(new Date('2026-09-05T00:00:00').getDate()).toBe(5);
  });

  it('a diferença aparece justamente na virada do mês', () => {
    expect(new Date('2026-09-01').getMonth() + 1).toBe(8); // agosto: errado
    expect(new Date('2026-09-01T00:00:00').getMonth() + 1).toBe(9); // setembro: certo
  });
});

describe('parseYYYYMMDDtoYM', () => {
  it('não depende de construir um Date', () => {
    expect(parseYYYYMMDDtoYM('2026-09-01')).toEqual({ y: 2026, m: 9 });
    expect(parseYYYYMMDDtoYM('2026-09-30')).toEqual({ y: 2026, m: 9 });
  });

  it('acerta o primeiro dia de janeiro, onde o erro vira um ano inteiro', () => {
    expect(parseYYYYMMDDtoYM('2027-01-01')).toEqual({ y: 2027, m: 1 });
  });

  it('acerta o último dia de dezembro', () => {
    expect(parseYYYYMMDDtoYM('2026-12-31')).toEqual({ y: 2026, m: 12 });
  });
});

describe('toExcelDate', () => {
  it('converte para o serial que o Excel espera', () => {
    // 01/01/2000 é o serial 36526 no Excel. A época usada (1899-12-30) compensa
    // o 29/02/1900 fantasma que o Excel considera existir; por isso ela só vale
    // de 01/03/1900 em diante — irrelevante para datas de lançamento.
    expect(toExcelDate('2000-01-01')).toBe(36526);
    expect(toExcelDate('1900-03-01')).toBe(61);
  });

  it('mantém o dia escrito, sem deslocar pelo fuso', () => {
    const cinco = toExcelDate('2026-09-05');
    const seis = toExcelDate('2026-09-06');

    expect(seis! - cinco!).toBe(1);
  });

  it('atravessa a virada do ano sem pular dia', () => {
    expect(toExcelDate('2027-01-01')! - toExcelDate('2026-12-31')!).toBe(1);
  });

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    expect(toExcelDate('2028-03-01')! - toExcelDate('2028-02-28')!).toBe(2);
  });

  it('devolve null para entrada ausente ou inválida', () => {
    expect(toExcelDate(undefined)).toBeNull();
    expect(toExcelDate('')).toBeNull();
  });
});

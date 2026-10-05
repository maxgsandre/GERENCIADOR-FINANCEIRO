import { describe, expect, it } from 'vitest';

import { Caixa, Cofrinho, Transacao } from '../App';
import {
  caixaSaldoNoMes,
  cofrinhoRendimentoAcumulado,
  cofrinhoSaldo,
  initialForMonth,
  monthlyTotalFor,
  principalOf,
} from './cofrinhoCalculations';

const caixa = (over: Partial<Caixa> = {}): Caixa => ({
  id: 'c1',
  nome: 'Conta',
  saldo: 0,
  tipo: 'conta_corrente',
  ...over,
});

let seq = 0;
const mov = (data: string, tipo: 'entrada' | 'saida', valor: number, caixaId = 'c1'): Transacao =>
  ({
    id: `t${++seq}`,
    caixaId,
    tipo,
    valor,
    descricao: 'mov',
    data,
    hora: '12:00',
  }) as Transacao;

describe('monthlyTotalFor', () => {
  it('soma entradas e subtrai saidas do mes', () => {
    const transacoes = [mov('2026-09-05', 'entrada', 1000), mov('2026-09-20', 'saida', 300)];

    expect(monthlyTotalFor(transacoes, 'c1', 2026, 9)).toBe(700);
  });

  it('ignora outros meses e outros caixas', () => {
    const transacoes = [
      mov('2026-08-31', 'entrada', 500),
      mov('2026-10-01', 'entrada', 500),
      mov('2026-09-10', 'entrada', 999, 'outro-caixa'),
      mov('2026-09-10', 'entrada', 100),
    ];

    expect(monthlyTotalFor(transacoes, 'c1', 2026, 9)).toBe(100);
  });

  it('inclui o primeiro e o ultimo dia do mes', () => {
    // Datas de borda sao o ponto onde um parse em UTC jogaria o lancamento
    // para o mes vizinho.
    const transacoes = [mov('2026-09-01', 'entrada', 10), mov('2026-09-30', 'entrada', 20)];

    expect(monthlyTotalFor(transacoes, 'c1', 2026, 9)).toBe(30);
  });

  it('devolve zero quando nao ha movimento', () => {
    expect(monthlyTotalFor([], 'c1', 2026, 9)).toBe(0);
  });
});

describe('initialForMonth', () => {
  it('usa o valor cadastrado quando o mes tem um', () => {
    const c = caixa({ initialByMonth: { '2026-09': 1500 } });

    expect(initialForMonth(c, '2026-09', [])).toBe(1500);
  });

  it('propaga o ultimo valor conhecido somando os meses intermediarios', () => {
    const c = caixa({ initialByMonth: { '2026-07': 1000 } });
    const transacoes = [mov('2026-07-10', 'entrada', 200), mov('2026-08-10', 'saida', 50)];

    // 1000 (inicial de julho) + 200 (julho) - 50 (agosto) = 1150 no inicio de setembro.
    expect(initialForMonth(c, '2026-09', transacoes)).toBe(1150);
  });

  it('nao considera meses posteriores ao pedido', () => {
    const c = caixa({ initialByMonth: { '2026-07': 1000, '2026-12': 9999 } });

    expect(initialForMonth(c, '2026-09', [])).toBe(1000);
  });

  it('escolhe o mes cadastrado mais recente antes do pedido', () => {
    const c = caixa({ initialByMonth: { '2026-01': 100, '2026-08': 800 } });

    expect(initialForMonth(c, '2026-09', [])).toBe(800);
  });

  it('devolve zero quando o caixa nao tem nenhum valor inicial', () => {
    expect(initialForMonth(caixa(), '2026-09', [])).toBe(0);
    expect(initialForMonth(caixa({ initialByMonth: {} }), '2026-09', [])).toBe(0);
  });

  it('devolve zero quando o unico valor cadastrado e futuro', () => {
    const c = caixa({ initialByMonth: { '2026-12': 500 } });

    expect(initialForMonth(c, '2026-09', [])).toBe(0);
  });

  it('atravessa a virada do ano', () => {
    const c = caixa({ initialByMonth: { '2026-11': 100 } });
    const transacoes = [mov('2026-11-10', 'entrada', 10), mov('2026-12-10', 'entrada', 20)];

    expect(initialForMonth(c, '2027-01', transacoes)).toBe(130);
  });
});

describe('caixaSaldoNoMes', () => {
  it('soma o inicial com o extrato do proprio mes', () => {
    const c = caixa({ initialByMonth: { '2026-09': 1000 } });
    const transacoes = [mov('2026-09-15', 'saida', 250)];

    expect(caixaSaldoNoMes(c, '2026-09', transacoes)).toBe(750);
  });

  it('pode ficar negativo', () => {
    const c = caixa({ initialByMonth: { '2026-09': 100 } });
    const transacoes = [mov('2026-09-15', 'saida', 400)];

    expect(caixaSaldoNoMes(c, '2026-09', transacoes)).toBe(-300);
  });
});

describe('cofrinhos', () => {
  const manual = (over: Partial<Cofrinho> = {}): Cofrinho => ({
    id: 'cof1',
    nome: 'Reserva',
    saldo: 1000,
    tipo: 'manual',
    dataCriacao: '2026-01-01',
    cor: '#000000',
    ...over,
  });

  it('principalOf soma o aporte inicial com os aportes seguintes', () => {
    const c = manual({
      valorAplicado: 1000,
      aportes: [
        { data: '2026-02-01', valor: 200 },
        { data: '2026-03-01', valor: 300 },
      ],
    });

    expect(principalOf(c)).toBe(1500);
  });

  it('cofrinho manual usa o saldo informado', () => {
    expect(cofrinhoSaldo(manual({ saldo: 2500 }))).toBe(2500);
  });

  it('cofrinho CDI rende sobre o principal e nunca fica abaixo dele', () => {
    const cdi = manual({
      tipo: 'cdi',
      percentualCDI: 100,
      valorAplicado: 10000,
      dataAplicacao: '2025-01-01',
      saldo: 0,
    });

    expect(cofrinhoSaldo(cdi)).toBeGreaterThan(10000);
  });

  it('rendimento acumulado nunca e negativo', () => {
    // Um cofrinho manual com saldo abaixo do aplicado nao deve reportar
    // rendimento negativo na tela.
    const c = manual({ valorAplicado: 1000, saldo: 800 });

    expect(cofrinhoRendimentoAcumulado(c)).toBe(0);
  });

  it('rendimento acumulado e a diferenca entre saldo e principal', () => {
    const c = manual({ valorAplicado: 1000, saldo: 1250 });

    expect(cofrinhoRendimentoAcumulado(c)).toBe(250);
  });
});

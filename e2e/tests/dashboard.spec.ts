import { expect, test } from '@playwright/test';

import { ESPERADO, MES, MES_APOS_QUITACAO } from '../support/ambiente';
import { card, entrar, esperarValorDoCard, linhaDaDivida, selecionarMes } from '../support/acoes';

test.beforeEach(async ({ page }) => {
  await entrar(page);
  await selecionarMes(page, MES);
});

test.describe('totais do mes', () => {
  test('mostra o saldo somado dos caixas', async ({ page }) => {
    await esperarValorDoCard(page, 'Total em Caixas', ESPERADO.totalEmCaixas);
  });

  test('separa entradas e saidas do extrato', async ({ page }) => {
    await esperarValorDoCard(page, 'Entradas do Mês', ESPERADO.entradas);
    await esperarValorDoCard(page, 'Saídas do Mês', ESPERADO.saidas);
  });

  test('soma os gastos fixos da competencia', async ({ page }) => {
    await esperarValorDoCard(page, 'Gastos Fixos do Mês', ESPERADO.gastosFixos);
  });

  test('soma as dividas esporadicas da competencia', async ({ page }) => {
    await esperarValorDoCard(page, 'Dívidas Esporádicas Mês', ESPERADO.dividasEsporadicas);
  });
});

test.describe('quitacao antecipada', () => {
  test('conta a parcela ativa no mes dela', async ({ page }) => {
    await esperarValorDoCard(page, 'Dívidas Parceladas do Mês', ESPERADO.dividasParceladas);
  });

  test('nao conta as parcelas inativadas nos meses seguintes', async ({ page }) => {
    // Este é o bug que originou a suíte. Em outubro a única parcela da dívida
    // está inativa: ela continua no banco, some da aba de Dívidas, e o Dashboard
    // chegou a somá-la mesmo assim, inflando o mês em R$ 500,00.
    await esperarValorDoCard(page, 'Dívidas Parceladas do Mês', ESPERADO.dividasParceladas);

    await selecionarMes(page, MES_APOS_QUITACAO);

    await esperarValorDoCard(page, 'Dívidas Parceladas do Mês', 0);
  });

  test('o saldo dos caixas se mantem apos a quitacao', async ({ page }) => {
    // A parcela inativa não pode nem somar como gasto nem sumir com o saldo:
    // outubro não tem movimento, então o total segue o de setembro.
    await selecionarMes(page, MES_APOS_QUITACAO);

    await esperarValorDoCard(page, 'Total em Caixas', ESPERADO.totalEmCaixas);
  });
});

test.describe('navegacao', () => {
  test('a aba de Dividas mostra a parcela ativa do mes', async ({ page }) => {
    await page.getByRole('button', { name: 'Dívidas' }).click();

    // Cada tela guarda o proprio mes selecionado e todas nascem no mes corrente,
    // entao escolher setembro no Dashboard nao se propaga para ca. Ver a secao
    // 5.1 de docs/CHECKLIST-MELHORIAS.md.
    await selecionarMes(page, MES);

    // A dívida é renderizada duas vezes: um cartão para telas estreitas, oculto
    // no desktop, e a linha da tabela. Buscar pela linha evita casar com o
    // elemento escondido.
    await expect(linhaDaDivida(page, 'Financiamento Carro')).toBeVisible();
  });

  test('a aba de Dividas esconde a parcela inativa no mes seguinte', async ({ page }) => {
    await page.getByRole('button', { name: 'Dívidas' }).click();
    await selecionarMes(page, MES_APOS_QUITACAO);

    await expect(linhaDaDivida(page, 'Financiamento Carro')).toHaveCount(0);
  });

  test('os cards principais do Dashboard estao todos presentes', async ({ page }) => {
    for (const titulo of [
      'Total em Caixas',
      'Entradas do Mês',
      'Saídas do Mês',
      'Gastos Fixos do Mês',
      'Dívidas Parceladas do Mês',
      'Dívidas Esporádicas Mês',
    ]) {
      await expect(card(page, titulo)).toBeVisible();
    }
  });
});

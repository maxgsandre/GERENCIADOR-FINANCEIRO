import { expect, type Locator, type Page } from '@playwright/test';

import { MES, USUARIO } from './ambiente';

/**
 * Card do Dashboard identificado pelo título exato. Os componentes de UI expõem
 * data-slot, o que evita depender de classes de estilo.
 */
export const card = (page: Page, titulo: string): Locator =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.locator('[data-slot="card-title"]', { hasText: new RegExp(`^${titulo}$`) }) })
    .first();

/** Converte um valor no formato pt-BR para número. "R$ 1.409,15" vira 1409.15. */
export const paraNumero = (texto: string): number => {
  const casado = texto.match(/-?R\$\s*-?[\d.]+,\d{2}/);
  const bruto = (casado ? casado[0] : texto).replace(/R\$|\s/g, '');
  const limpo = bruto.replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.');
  return (bruto.includes('-') ? -1 : 1) * Number(limpo);
};

/** Leitura pontual do valor de um card. Prefira `esperarValorDoCard`. */
export const valorDoCard = async (page: Page, titulo: string): Promise<number> => {
  const texto = await card(page, titulo).locator('[data-slot="card-content"]').innerText();
  return paraNumero(texto);
};

/**
 * Espera o card chegar ao valor informado.
 *
 * Os dados vêm por listener do Firestore e os cards nascem zerados, então uma
 * leitura única acusaria R$ 0,00 antes da primeira resposta. `expect.poll`
 * repete a leitura até o valor bater ou o tempo acabar.
 */
export const esperarValorDoCard = async (page: Page, titulo: string, esperado: number) => {
  await expect
    .poll(() => valorDoCard(page, titulo), {
      message: `card "${titulo}" nao chegou a ${esperado}`,
      timeout: 15_000,
    })
    .toBeCloseTo(esperado, 2);
};

/** Espera a primeira carga do Firestore, que deixa o total de caixas positivo. */
export const esperarDadosCarregados = async (page: Page) => {
  await expect
    .poll(() => valorDoCard(page, 'Total em Caixas'), {
      message: 'os dados do Firestore nao chegaram',
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
};

/** Faz login com o usuário do seed e espera o Dashboard com dados. */
export const entrar = async (page: Page) => {
  await page.goto('/');

  await page.getByLabel('Email').fill(USUARIO.email);
  await page.getByLabel('Senha').fill(USUARIO.senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  // O título da página é um h2; o h1 do topo também se chama "Dashboard".
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 2 })).toBeVisible();
  await esperarDadosCarregados(page);
};

/** Troca o mês exibido e espera o seletor confirmar o novo valor. */
export const selecionarMes = async (page: Page, mes: string = MES) => {
  const seletor = page.locator('input[type="month"]').first();
  await seletor.fill(mes);
  await expect(seletor).toHaveValue(mes);
};

/**
 * Linha da tabela de dívidas com a descrição informada.
 *
 * A lista é renderizada duas vezes — um cartão para telas estreitas, oculto no
 * desktop, e a tabela — então buscar só pelo texto casaria com o elemento
 * invisível.
 */
export const linhaDaDivida = (page: Page, descricao: string): Locator =>
  page.getByRole('row').filter({ hasText: descricao });

import { expect, test } from '@playwright/test';

import { MES } from '../support/ambiente';
import { entrar } from '../support/acoes';

test.describe('exportacao para Excel', () => {
  test('gera o arquivo do mes selecionado', async ({ page }) => {
    await entrar(page);

    // O menu do usuário fica no avatar, no canto superior direito.
    await page.locator('button').filter({ has: page.locator('.rounded-full') }).last().click();
    await page.getByText('Exportar Dados').click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    await dialogo.locator('input[type="month"]').fill(MES);

    const download = page.waitForEvent('download', { timeout: 30_000 });
    await dialogo.getByRole('button', { name: 'Exportar' }).click();
    const arquivo = await download;

    // O nome carrega o mês pedido, e não a data de hoje.
    expect(arquivo.suggestedFilename()).toBe(`financeiro-${MES}.xlsx`);

    const caminho = await arquivo.path();
    expect(caminho, 'o arquivo nao foi salvo em disco').toBeTruthy();
  });

  test('o arquivo gerado e um xlsx valido e nao esta vazio', async ({ page }) => {
    await entrar(page);

    await page.locator('button').filter({ has: page.locator('.rounded-full') }).last().click();
    await page.getByText('Exportar Dados').click();

    const dialogo = page.getByRole('dialog');
    await dialogo.locator('input[type="month"]').fill(MES);

    const download = page.waitForEvent('download', { timeout: 30_000 });
    await dialogo.getByRole('button', { name: 'Exportar' }).click();
    const arquivo = await download;

    const fs = await import('node:fs/promises');
    const caminho = await arquivo.path();
    const conteudo = await fs.readFile(caminho!);

    // Um .xlsx e um zip: comeca com "PK".
    expect(conteudo.subarray(0, 2).toString()).toBe('PK');
    expect(conteudo.byteLength).toBeGreaterThan(5_000);
  });
});

import { expect, test } from '@playwright/test';

import { USUARIO } from '../support/ambiente';
import { entrar } from '../support/acoes';

test.describe('acesso', () => {
  test('a tela de login aparece para quem nao esta autenticado', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
  });

  test('o usuario do seed consegue entrar e ver dados', async ({ page }) => {
    await entrar(page);

    await expect(page.getByRole('heading', { name: 'Dashboard', level: 2 })).toBeVisible();
  });

  test('a aplicacao conversa com o emulador, nao com o Firebase real', async ({ page }) => {
    const producao: string[] = [];
    page.on('request', (req) => {
      if (/googleapis\.com|firebaseio\.com|firebaseapp\.com/.test(new URL(req.url()).host)) {
        producao.push(req.url());
      }
    });

    // Espera explicitamente a chamada de login sair para o emulador de auth, em
    // vez de inspecionar uma lista depois — assim o teste nao depende de timing.
    const chamadaDeAuth = page.waitForRequest(
      (req) => req.url().includes('127.0.0.1:9099') && req.method() === 'POST',
      { timeout: 30_000 }
    );

    await page.goto('/');
    await page.getByLabel('Email').fill(USUARIO.email);
    await page.getByLabel('Senha').fill(USUARIO.senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await chamadaDeAuth;
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 2 })).toBeVisible();

    // Nenhuma chamada pode ter saido para os dominios de producao do Firebase.
    expect(producao, `chamadas para producao: ${producao.join(', ')}`).toEqual([]);
  });

  test('o Firestore consultado e o emulador local', async ({ page }) => {
    const consultaAoFirestore = page.waitForRequest(
      (req) => req.url().includes('127.0.0.1:8080') && req.url().includes('Firestore'),
      { timeout: 30_000 }
    );

    await entrar(page);

    await consultaAoFirestore;
  });
});

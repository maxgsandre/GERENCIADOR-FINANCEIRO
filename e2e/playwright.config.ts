import { defineConfig, devices } from '@playwright/test';

import { PORTA_APP, URL_APP } from './support/ambiente';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  // A tela espera o Firestore responder por listeners; o padrão de 5s é curto
  // para a primeira carga do dashboard.
  expect: { timeout: 15_000 },
  // Um único banco no emulador, compartilhado: os fluxos rodam em ordem.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: URL_APP,
    locale: 'pt-BR',
    // O sistema opera em horário de Brasília e as regras de vencimento dependem
    // disso. Mesmo fuso da suíte de unidade (ver vitest.config.ts).
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: {
    // --host 127.0.0.1: sem isso o Vite liga em localhost, que em algumas
    // maquinas Windows resolve so para ::1, e a espera do Playwright estoura.
    command: `npm run dev -- --mode e2e --host 127.0.0.1 --port ${PORTA_APP} --strictPort`,
    cwd: '..',
    url: URL_APP,
    // Nunca reaproveitar: um dev server ja aberto aponta para o Firebase real,
    // e os testes escreveriam em dados de verdade.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { E2E: 'true' },
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

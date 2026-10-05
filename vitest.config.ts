import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // As regras de parcela e vencimento sao sensiveis a fuso: travar o fuso de
    // operacao evita que a suite passe na maquina de quem desenvolve e falhe no CI.
    env: {
      TZ: 'America/Sao_Paulo',
    },
  },
});

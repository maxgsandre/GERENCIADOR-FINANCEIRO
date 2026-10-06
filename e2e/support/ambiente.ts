/** Configuração compartilhada entre o orquestrador e os testes. */

/** Porta própria, para nunca reaproveitar um dev server apontado para produção. */
export const PORTA_APP = 3100;

export const URL_APP = `http://127.0.0.1:${PORTA_APP}`;

export const PROJETO_EMULADOR = 'demo-gerenciador-financeiro';

/** Usuário criado por scripts/seed-emulator.mjs. */
export const USUARIO = {
  email: 'teste@exemplo.local',
  senha: 'teste123',
};

/** Mês com a parcela ativa da dívida. */
export const MES = '2026-09';

/** Mês seguinte, onde a única parcela existente está inativa pela quitação. */
export const MES_APOS_QUITACAO = '2026-10';

/**
 * Valores que o seed produz. Ficam aqui para os testes afirmarem números exatos
 * sem repetir contas.
 */
export const ESPERADO = {
  /** 2.150 de saldo inicial + 5.000 de entrada - 350,50 de saída. */
  totalEmCaixas: 2150 + 5000 - 350.5,
  entradas: 5000,
  saidas: 350.5,
  gastosFixos: 1200 + 99.9,
  /** A parcela de setembro, única ativa da dívida. */
  dividasParceladas: 500,
  dividasEsporadicas: 80,
};

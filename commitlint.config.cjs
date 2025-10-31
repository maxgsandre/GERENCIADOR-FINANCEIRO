/**
 * Commitlint configuration to enforce Conventional Commits.
 * Examples:
 *  - feat: add new payment modal
 *  - fix(dividas): corrigir cálculo de parcela do mês
 *  - chore: update dependencies
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Permitir cabeçalhos maiores (até 120 chars)
    'header-max-length': [2, 'always', 120],
    // Permitir escopo opcional e assuntos em qualquer caso
    'scope-empty': [0],
    'subject-case': [0],
  },
};



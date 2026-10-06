/**
 * Orquestra a suíte end-to-end.
 *
 * Sobe os emuladores de Auth e Firestore, popula o cenário, roda o Playwright e
 * derruba tudo ao final — inclusive se a suíte falhar.
 *
 * O `emulators:exec` do firebase-tools cuida do ciclo de vida do emulador; o
 * dev server fica por conta do `webServer` do Playwright.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJETO = 'demo-gerenciador-financeiro';

const temFirebaseTools = () =>
  spawnSync('firebase', ['--version'], { shell: true, stdio: 'ignore' }).status === 0;

if (!temFirebaseTools()) {
  console.error(
    '\nfirebase-tools nao encontrado.\n' +
      'Instale com: npm install -g firebase-tools\n' +
      'O emulador do Firestore tambem exige Java 11 ou superior.\n'
  );
  process.exit(1);
}

// Roda dentro do emulador: popula o cenario e so entao executa os testes.
// Caminhos relativos a raiz do projeto, para nao precisar de aspas aninhadas.
const extras = process.argv.slice(2).join(' ');
const interno = [
  'node scripts/seed-emulator.mjs',
  `cd e2e && npx playwright test${extras ? ` ${extras}` : ''}`,
].join(' && ');

const { status } = spawnSync(
  'firebase',
  ['emulators:exec', '--only', 'auth,firestore', '--project', PROJETO, `"${interno}"`],
  { stdio: 'inherit', shell: true, cwd: raiz }
);

process.exit(status ?? 1);

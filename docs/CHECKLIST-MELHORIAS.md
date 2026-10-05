# Checklist de melhorias — Gerenciador Financeiro

Levantamento feito em 05/10/2026 a partir de uma análise do código e dos dados reais
(backup de 10/09/2026). Cada item aponta onde está o problema e como validar a correção.

A ordem é proposital: a **Fase 1 monta a rede de segurança** antes de mexer em regra de
negócio. O bug que motivou essa revisão — parcelas inativas somadas no Dashboard — teria
sido pego por um teste de dez linhas.

**Legenda de prioridade:** 🔴 crítico · 🟡 relevante · 🔵 dívida técnica

---

## Fase 1 — Rede de segurança (testes e CI)

Referência: o projeto `fichas-onprime` já usa Vitest para unidade, Playwright para
end-to-end e GitHub Actions encadeando os dois. O padrão é reaproveitável aqui.

### 1.1 Vitest para a lógica pura 🔴

- [ ] Instalar `vitest` e criar `vitest.config.ts` (ambiente `node`, sem jsdom por ora).
- [ ] Adicionar os scripts `test` (`vitest run`) e `test:watch` (`vitest`) no `package.json`.
- [ ] Cobrir `src/utils/monthlyCalculations.ts`:
  - `getDividasDoMes` ignora parcelas com `inativa: true`.
  - `getDividasDoMes` respeita `periodo` e também o caminho legado sem `periodo`.
  - `getMonthlyDue` devolve `valorParcela` para parcelada e `valorTotal` para esporádica.
  - `getMonthlyDue` ajusta os centavos na última parcela.
- [ ] Cobrir `src/utils/cofrinhoCalculations.ts`:
  - `initialForMonth` propaga o saldo quando o mês não tem valor inicial cadastrado.
  - `caixaSaldoNoMes` = inicial + extrato do mês.
- [ ] Cobrir `src/utils/exportXlsx.ts`:
  - O total de "dívidas em aberto" soma `valorParcela`, nunca `valorTotal`
    (regressão do bug que inflava o número para R$ 841 mil).
- [ ] Criar um teste de fuso dedicado, no espírito do `timezone.test.ts` do
  `fichas-onprime`, fixando `TZ=America/Sao_Paulo` e travando a regra de que data
  `YYYY-MM-DD` sempre vira `T00:00:00` local.

**Por que primeiro:** essas quatro áreas concentram todos os bugs de cálculo já
encontrados e nenhuma delas toca o Firebase — dá pra testar sem infraestrutura nenhuma.

### 1.2 CI no GitHub Actions 🔴

- [ ] Criar `.github/workflows/ci.yml` disparando em push e PR para `main` e `homolog`.
- [ ] Job de verificação: `npm ci` → `npm run lint` → `npm test` → `npm run build`.
- [ ] Usar `concurrency` com `cancel-in-progress` para um push novo cancelar o anterior.
- [ ] Definir as variáveis `VITE_FIREBASE_*` como valores de fachada no CI — o build
  precisa delas, mas nada no pipeline acessa o Firebase de verdade.

### 1.3 Emulador do Firebase (pré-requisito do E2E) 🟡

- [ ] Adicionar `firebase.json` configurando os emuladores de Auth (9099) e Firestore (8080).
- [ ] Adicionar `firebase-tools` como dependência de desenvolvimento.
- [ ] Criar um script de seed que popule o emulador com um cenário conhecido
  (um caixa, uma dívida parcelada, uma quitação antecipada).
- [ ] Documentar no README como subir o ambiente com `VITE_USE_FIREBASE_EMULATOR=true`.

O gancho já existe em [`src/lib/firebase.ts`](../src/lib/firebase.ts) — falta só a configuração.

### 1.4 Playwright end-to-end 🔵

Só depois de 1.3. Rodar E2E contra o Firebase de produção poluiria os dados reais.

- [ ] Criar o pacote `e2e/` com `package.json` próprio, como no `fichas-onprime`.
- [ ] `playwright.config.ts` com `locale: 'pt-BR'` e `timezoneId: 'America/Sao_Paulo'`
  (essencial dado o histórico de bugs de fuso).
- [ ] Fluxos mínimos a cobrir:
  - Login e carregamento do Dashboard.
  - Lançar uma dívida parcelada e conferir o valor no Dashboard.
  - Quitar antecipadamente e confirmar que os meses seguintes zeram.
  - Exportar o `.xlsx` e validar que o arquivo foi gerado.
- [ ] Encadear no CI com `needs: verificacao` e publicar o relatório em caso de falha.

### 1.5 Regras do Firestore versionadas 🔴

- [ ] Exportar as regras atuais do console para `firestore.rules` e commitar.
- [ ] Adicionar os índices em `firestore.indexes.json`.
- [ ] Validar que cada usuário só lê e escreve sob o próprio `userId`.

Hoje as regras de um aplicativo financeiro existem apenas no console do Firebase, sem
histórico, sem revisão e sem forma de restaurar se forem alteradas por engano.

---

## Fase 2 — Correções críticas

### 2.1 Exclusão de cartão sem confirmação 🔴

- [ ] Corrigir [`DividasManager.tsx:387`](../src/components/DividasManager.tsx#L387) (arquivar cartão).
- [ ] Corrigir [`DividasManager.tsx:407`](../src/components/DividasManager.tsx#L407) (excluir cartão).

O `confirm` do projeto é o [`ConfirmContext`](../src/contexts/ConfirmContext.tsx), que
devolve uma `Promise`. Sem `await`, o `if` testa o objeto da Promise — sempre verdadeiro —
e o `return` nunca executa. Na prática o cartão e **todas as compras** são apagados no
clique, enquanto o diálogo aparece e é ignorado.

As outras 14 chamadas do projeto usam `await` corretamente. A correção é trocar
`if (!confirm(...))` por `if (!(await confirm(...)))`.

- [ ] Remover o `for` de corpo vazio logo abaixo, em `handleDeleteCard`.

**Como validar:** cancelar o diálogo e confirmar que o cartão continua existindo.

### 2.2 Data exibida um dia antes 🟡

- [ ] Corrigir [`CaixasManager.tsx:1177`](../src/components/CaixasManager.tsx#L1177).

`new Date('2026-09-05')` é interpretado como meia-noite **UTC**; no fuso de Brasília
isso exibe `04/09/2026`. A ordenação no mesmo arquivo (linha 802) já usa `+ 'T00:00:00'`
e acerta — só a exibição ficou para trás.

- [ ] Revisar o mesmo padrão em [`monthlyCalculations.ts:45`](../src/utils/monthlyCalculations.ts#L45).
  Atinge apenas o caminho legado (dívidas sem `periodo`), hoje sem ocorrências nos dados,
  mas é uma armadilha latente.
- [ ] Centralizar a conversão num helper único e cobrir com o teste da Fase 1.

---

## Fase 3 — Dados inconsistentes

### 3.1 Parcelas órfãs do Financiamento Carro 🟡

- [ ] Inativar as parcelas 45/48 e 46/48 (competências 2027-08 e 2027-09).

A quitação antecipada inativou as parcelas 33 a 46, mas duas sobreviveram porque têm
`debtId` diferente (`b1bf6e04…` em vez de `82016075…`). Vão reaparecer como cobrança de
R$ 479,92 nesses dois meses.

- [ ] Ajustar o auto-heal do [`DividasManager.tsx:122`](../src/components/DividasManager.tsx#L122)
  para também agrupar por descrição + valor, e não só por `debtId`.

### 3.2 Agrupamento com perda na aba Dívidas 🟡

- [ ] Decidir o destino da deduplicação em `DividasManager` (a partir da linha 1756).

A regra agrupa lançamentos com mesma descrição, mesmo valor e mesmo mês, mantendo só um.
Dois almoços de R$ 9,00 no mesmo mês viram um. Foram encontrados 8 casos no histórico.
O Dashboard e o Excel **não** aplicam essa regra, então os dois divergem nesses meses.

Opções: remover a deduplicação (os lançamentos são legítimos) ou aplicá-la também no
Dashboard. A primeira parece correta; a segunda ao menos deixa tudo coerente.

---

## Fase 4 — Ajustes visuais

### 4.1 Valor negativo em verde 🟡

- [ ] [`Dashboard.tsx:264`](../src/components/Dashboard.tsx#L264) — "Total em Caixas" tem
  `text-green-600` fixo. Um saldo de `-R$ 3.987,43` é exibido em verde, lendo-se como
  positivo. O "Balanço do Mês" (linha 401) já troca a cor pelo sinal.
- [ ] Extrair um helper `corPorSinal(valor)` e aplicar nos 16 pontos com cor fixa.

### 4.2 Gráfico de pizza 🟡

- [ ] Corrigir o título: o card se chama "Gastos Fixos por Categoria", mas
  [`dadosGastos`](../src/components/Dashboard.tsx#L186) soma gastos fixos **mais** dívidas
  esporádicas.
- [ ] Resolver a contagem dupla: as esporádicas aparecem nesse gráfico e de novo no gráfico
  próprio logo abaixo.
- [ ] Agrupar fatias abaixo de ~2% em "Outros". Hoje toda fatia recebe rótulo, inclusive as
  de 0% — com 19 categorias os rótulos se sobrepõem e ficam ilegíveis.

### 4.3 Interface morta nos cofrinhos 🔵

- [ ] Remover a barra de progresso de "Objetivo" em
  [`Dashboard.tsx:649`](../src/components/Dashboard.tsx#L649) — ou implementar o campo.

`cofrinho.objetivo` não existe na interface `Cofrinho`, nenhum formulário grava o campo e
nenhum cofrinho o possui. O bloco nunca renderiza. Só compila porque o `tsconfig` está com
`"strict": false`.

---

## Fase 5 — Atrito operacional

### 5.1 O mês não acompanha a navegação 🟡

- [ ] Mover `selectedMonth` para o `FinanceiroContext` em `App.tsx`.
- [ ] Remover o estado local de Dashboard, Caixas, Dívidas e Gastos Fixos.
- [ ] Usar o mesmo valor como padrão no diálogo de exportação.

As quatro telas mantêm cópias independentes, todas iniciadas no mês atual. Escolher
setembro no Dashboard e navegar para Dívidas volta para o mês corrente.

---

## Fase 6 — Dívida técnica

### 6.1 Helpers de data duplicados 🔵

- [ ] Importar de `monthlyCalculations.ts` em vez de redefinir localmente.

`ymToIndex` está reescrito em 8 arquivos, `parseYM` em 6 e `nextYM` em 4, embora os três
já sejam exportados. É a mesma classe de duplicação que fez o Dashboard divergir da aba
de Dívidas.

- [ ] `src/utils/cofrinhoCalculations.ts` (linhas 3-8) redefine os três.
- [ ] `src/components/Dashboard.tsx:17` tem um `ymToIndex` órfão, sem uso.

### 6.2 Código morto 🔵

- [ ] Remover `migrateDividaToSubcollection` (~90 linhas em `firebaseService.ts`), chamada
  apenas de dentro de um bloco comentado. Contém um bug de `setMonth` que, numa dívida com
  vencimento no dia 31, pularia fevereiro e jogaria duas parcelas em março.
- [ ] Remover o bloco comentado de 24 linhas que a invoca.
- [ ] Zerar os 258 avisos do ESLint (0 erros) — imports e variáveis sem uso, em maioria.

### 6.3 TypeScript permissivo 🔵

- [ ] Ativar `"strict": true` no `tsconfig.json` e tratar os erros por arquivo.
- [ ] Reduzir os 368 usos de `any`, concentrados em `DividasManager` (89),
  `firebaseService` (78) e `GastosFixosManager` (58).

Foi o modo permissivo que deixou passar o `cofrinho.objetivo` do item 4.3.

### 6.4 Componentes grandes demais 🔵

- [ ] Avaliar a quebra de `DividasManager.tsx` (3.214 linhas), `firebaseService.ts` (2.136)
  e `GastosFixosManager.tsx` (2.010).

Não é urgente e não deve ser feito sem os testes da Fase 1 no lugar. Fica registrado
porque o tamanho é o que torna caro revisar qualquer mudança nesses arquivos.

---

## Ordem sugerida de execução

1. **Fase 1.1 e 1.2** — Vitest e CI. Sem rede, todo o resto é feito no escuro.
2. **Fase 2.1** — o bug do `confirm`, por ser destrutivo e de duas linhas.
3. **Fase 4.1 e 4.2** — visual, barato e de efeito imediato.
4. **Fase 3** — decidir o destino dos dados inconsistentes.
5. **Fase 5** — o mês compartilhado, que é o que mais muda o dia a dia.
6. **Fase 1.3 a 1.5** — emulador, E2E e regras do Firestore.
7. **Fase 6** — dívida técnica, com os testes já protegendo.

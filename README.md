# Lumen

Aplicação de gestão financeira construída com Nuxt 3, Vue 3 e TypeScript. O backend usa Nitro (rotas em `server/api`) com SQLite via better-sqlite3, sem ORM. A dashboard ainda usa mocks tipados; a área de Categorias já persiste dados reais.

## Como rodar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

Verificações disponíveis:

```bash
npm run typecheck
npm run build
```

## Deploy (produção)

O Lumen roda no droplet em `http://137.184.195.81`, no lugar da app antiga (`gestao-financeira`).

No Windows (recomendado):

```powershell
.\deploy.ps1
```

No Git Bash / WSL (se a chave SSH estiver acessível):

```bash
bash deploy.sh
```

O script faz build, envia `.output`, troca o bundle em `/app`, reinstala `better-sqlite3` nativo no Linux, sobe o SQLite local (`.data/lumen.sqlite3`) e reinicia o PM2 (`financas`). Backups ficam em `/app/backups`.

## Banco de dados

- Arquivo SQLite persistente em `.data/lumen.sqlite3` (fora do `.output` e ignorado pelo git). Sobrescreva o caminho com a variável `LUMEN_DB_PATH`.
- Conexão, migrações e utilitários em `server/utils/db.ts`.
- Datas armazenadas como texto local `YYYY-MM-DD`.

## Organização

- `assets/css/tokens.css`: tokens de cor, tipografia, espaçamento, raio e sombra.
- `assets/css/main.css`: estilos globais e utilitários mínimos.
- `components/ui`: componentes reutilizáveis do design system (Button, Card, StatCard, Badge, Tabs, SegmentedControl, TextField, Drawer, Money, Skeleton, EmptyState...).
- `components/dashboard`: composição específica da dashboard.
- `components/categories`: cards, pickers e drawers da área de categorias.
- `pages/contas` e `pages/contas/[id].vue`: contas e lançamentos.
- `pages/cartoes` e `pages/cartoes/[id].vue`: cartões de crédito (CRUD + fatura com despesas).
- `pages/relatorios`: relatório de **Fluxo de Caixa** (saldo dia a dia real/projetado).
- `server/api/entries`: criação/listagem/exclusão de lançamentos.
- `server/api/categories`, `server/api/supercategories`, `server/api/accounts` e `server/api/cards`: CRUD em SQLite.
- `server/api/reports/cash-flow`: série diária de saldo bancário + projeção (faturas no vencimento).
- `GET /api/cards/projection`: projeção consolidada de faturas (12 meses, todos os cartões).
- `utils/bankCatalog.ts`: bancos pré-cadastrados e cores.
- Cartões: `closing_day` = dia de **fechamento** da fatura (não início de ciclo); `due_day` = vencimento do boleto. Despesas de cartão ficam em `entries` com `card_id` preenchido e `account_id` NULL.
- Detalhe do cartão: `GET /api/cards/:id/invoice?month=YYYY-MM` agrupa lançamentos pela janela de fechamento (`utils/cardInvoiceCycle.ts`). CRUD em `POST/PUT/DELETE /api/cards/:id/expenses`. Pagamento de fatura (debitar conta) fica para a fase seguinte.
- Fluxo de caixa: dias ≤ hoje usam saldo bancário real; dias > hoje partem do saldo de hoje e acumulam ocorrências de conta + faturas abertas no vencimento. Despesas de cartão na data da compra não entram no caixa.
- `server/utils/categorySeedData.ts`: seed das supercategorias e categorias da aplicação antiga. Em banco vazio o seed roda automaticamente; para reaplicar: `POST /api/dev/seed-categories`.
- Contas seed (saldo vazio): `POST /api/dev/seed-accounts`.

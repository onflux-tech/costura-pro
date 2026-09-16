<h1 align="center">Costura Pro</h1>

<p align="center">
  <strong>Local-first management app for a single sewing atelier: quotes, work orders, inventory, finances and non-fiscal documents, on the desktop and offline on the phone.</strong>
</p>

<p align="center">
  <a href="https://github.com/onflux-tech/costura-pro/actions/workflows/ci.yml"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/ci/onflux-tech/costura-pro.svg?workflow=ci.yml&amp;branch=main&amp;variant=secondary&amp;size=sm&amp;mode=dark"><img alt="CI" src="https://www.shieldcn.dev/github/ci/onflux-tech/costura-pro.svg?workflow=ci.yml&amp;branch=main&amp;variant=secondary&amp;size=sm&amp;mode=light"></picture></a>
  <a href="LICENSE"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/license/onflux-tech/costura-pro.svg?variant=ghost&amp;size=sm&amp;mode=dark"><img alt="License" src="https://www.shieldcn.dev/github/license/onflux-tech/costura-pro.svg?variant=ghost&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://github.com/onflux-tech/costura-pro/commits/main"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/last-commit/onflux-tech/costura-pro.svg?variant=secondary&amp;size=sm&amp;mode=dark"><img alt="Last commit" src="https://www.shieldcn.dev/github/last-commit/onflux-tech/costura-pro.svg?variant=secondary&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://github.com/onflux-tech/costura-pro/stargazers"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/stars/onflux-tech/costura-pro.svg?variant=secondary&amp;size=sm&amp;mode=dark"><img alt="GitHub Stars" src="https://www.shieldcn.dev/github/stars/onflux-tech/costura-pro.svg?variant=secondary&amp;size=sm&amp;mode=light"></picture></a>
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Language · TypeScript" src="https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&amp;variant=branded&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://pnpm.io/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Package_mgr-pnpm-F69220.svg?logo=pnpm&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Package mgr · pnpm" src="https://www.shieldcn.dev/badge/Package_mgr-pnpm-F69220.svg?logo=pnpm&amp;variant=branded&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://turborepo.com/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Monorepo-Turborepo-EF4444.svg?logo=turborepo&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Monorepo · Turborepo" src="https://www.shieldcn.dev/badge/Monorepo-Turborepo-EF4444.svg?logo=turborepo&amp;variant=branded&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://biomejs.dev/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Lint-Biome-60A5FA.svg?logo=biome&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Lint · Biome" src="https://www.shieldcn.dev/badge/Lint-Biome-60A5FA.svg?logo=biome&amp;variant=branded&amp;size=sm&amp;mode=light"></picture></a>
  <a href="AGENTS.md"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Agent--friendly-AGENTS.md-D97757.svg?variant=secondary&amp;size=sm&amp;mode=dark"><img alt="Agent-friendly AGENTS.md" src="https://www.shieldcn.dev/badge/Agent--friendly-AGENTS.md-D97757.svg?variant=secondary&amp;size=sm&amp;mode=light"></picture></a>
</p>

<p align="center">
  <strong><a href="#english">English</a></strong> | <strong><a href="#portugues">Português</a></strong>
</p>

---

<a id="english"></a>

## English

### Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Project Status](#project-status)
- [Quick Start](#quick-start)
- [Development](#development)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [AI-Assisted Development](#ai-assisted-development)
- [Contributing](#contributing)
- [License](#license)

### Overview

Costura Pro helps the owner of **one sewing atelier** serve customers, plan work, control materials and finished goods, price with margin, track cash and emit non-fiscal documents. A Windows PC (Ubuntu 24.04 is also supported) is the source of truth and works without internet; the same interface runs as a Tauri desktop app and as an installable PWA on Android and iPhone, which keeps working offline and syncs through a Cloudflare Tunnel. It is not SaaS and does not issue tax documents.

### Key Features

Target scope of v1 (see [Project Status](#project-status)):

- **Customers and measurements** -- payer and garment wearer profiles, versioned measurement templates and custody of received garments with receipts and QR labels
- **Quotes and work orders** -- revisions, partial acceptance, work orders with independent sub-items and separate production, delivery and payment states
- **Production and direct sales** -- internal production orders, finished-goods stock with moving average cost and direct sale of ready products
- **Inventory** -- material variants, locations, lots, purchase unit conversion, reservations and a consolidated shopping list
- **Finances** -- receivables, split payments, card settlement, expenses and accrual versus cash reports
- **Frozen documents** -- A4 and 80 mm PDFs with hash, emitted even offline, always marked as non-fiscal
- **Offline-first mobile** -- encrypted per-device vault, idempotent outbox and conflict inbox
- **Safe operation** -- daily restorable backups, coordinated updates with rollback and money stored as integer cents

### Project Status

Foundation phase (F0): monorepo, pricing and reservation rules, native SQLite and the AI agent harness are ready. Login and sign-up are still the scaffold defaults, so **do not use it with real data or expose it through a tunnel yet**. Phases and exit criteria are in the [roadmap](docs/ROADMAP.md).

### Quick Start

Requirements: Node.js 24, pnpm 11.20.0, Bun 1.4.2 and, for the desktop app only, Rust with the Tauri v2 prerequisites (on Windows, the MSVC toolchain).

```bash
pnpm install
```

Create `apps/server/.env` (`BETTER_AUTH_SECRET` and `DATABASE_FILE` as an absolute local path; keep `PORT` at 3000, the port the Vite proxy and the Tauri app expect, and leave `CANONICAL_ORIGIN` empty until the Tunnel exists) from the versioned `apps/server/.env.schema`, then apply the migrations:

```bash
pnpm db:migrate
```

### Development

```bash
pnpm dev          # web on localhost:3001, proxying /api and /rpc to the API on 127.0.0.1:3000
pnpm build && pnpm --filter server start   # SPA and API in one process on 127.0.0.1:3000
cd apps/web && pnpm desktop:dev   # Tauri desktop app, with pnpm dev:server running
```

Verification, the same commands the CI runs on Ubuntu 24.04 and Windows:

```bash
pnpm harness:check && pnpm docs:check && pnpm harness:test
pnpm test && pnpm check && pnpm check-types && pnpm build
```

### Project Structure

```
costura-pro/
├── apps/
│   ├── web/            # React SPA (TanStack Router, Vite, PWA)
│   │   └── src-tauri/  # Tauri v2 desktop app
│   └── server/         # Hono, oRPC, Better Auth, evlog (Bun)
├── packages/
│   ├── api/            # oRPC routers and context
│   ├── auth/           # Better Auth configuration
│   ├── config/         # base tsconfig
│   ├── db/             # Drizzle schema, migrations, native SQLite
│   ├── domain/         # pure domain rules
│   └── ui/             # shadcn/ui components and styles
├── docs/               # PRD, roadmap, spec, harness, references, ADRs
└── scripts/            # harness generator and documentation checks
```

### Documentation

Project documentation is written in Brazilian Portuguese. Start at the [documentation index](docs/README.md): product requirements, roadmap, engineering spec, glossary and architecture decision records.

### AI-Assisted Development

The repository ships a harness for Claude Code (default) and Codex: [AGENTS.md](AGENTS.md) with invariants and area rules, generated agent roles and skills, session hooks that block unsafe commands and ask for docs and harness updates before a session ends, and checks that keep documentation links, paths and requirement traceability honest. Details in [docs/HARNESS.md](docs/HARNESS.md).

### Contributing

1. Read [AGENTS.md](AGENTS.md) and the [roadmap](docs/ROADMAP.md).
2. Create a branch per delivery and follow TDD.
3. Keep every verification command green and update the curated docs in the same change.
4. Use English conventional commits.

### License

Released under the [MIT License](LICENSE).

---

<a id="portugues"></a>

## Português

### Índice

- [Visão geral](#visão-geral)
- [Principais recursos](#principais-recursos)
- [Estado do projeto](#estado-do-projeto)
- [Início rápido](#início-rápido)
- [Desenvolvimento](#desenvolvimento)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Documentação](#documentação)
- [Desenvolvimento com agentes de IA](#desenvolvimento-com-agentes-de-ia)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

### Visão geral

O Costura Pro ajuda o dono de **um único ateliê de costura** a atender clientes, planejar trabalhos, controlar materiais e peças acabadas, precificar com margem, acompanhar o caixa e emitir documentos não fiscais. Um PC Windows (Ubuntu 24.04 também é suportado) é a fonte dos dados e funciona sem internet; a mesma interface roda como app desktop Tauri e como PWA instalável no Android e no iPhone, que continua funcionando offline e sincroniza pelo Cloudflare Tunnel. Não é SaaS e não emite documento fiscal.

### Principais recursos

Escopo previsto da v1 (veja [Estado do projeto](#estado-do-projeto)):

- **Clientes e medidas** -- cliente pagador e perfis de quem usa a peça, modelos de medidas versionados e custódia de peças recebidas com comprovante e etiqueta QR
- **Orçamentos e ordens de serviço** -- revisões, aceite parcial, OS com subitens independentes e estados separados de produção, entrega e financeiro
- **Produção e venda direta** -- ordens de produção internas, estoque de acabados com custo médio e venda direta de produtos prontos
- **Estoque** -- variantes de material, locais, lotes, conversão de embalagem, reservas e lista de compras consolidada
- **Finanças** -- recebíveis, pagamentos divididos, liquidação de cartão, despesas e relatórios de competência e caixa
- **Documentos congelados** -- PDFs A4 e 80 mm com hash, emitidos até offline e sempre marcados como não fiscais
- **Celular offline-first** -- cofre cifrado por aparelho, fila idempotente e caixa de conflitos
- **Operação segura** -- backup diário restaurável, atualização coordenada com reversão e dinheiro guardado em centavos inteiros

### Estado do projeto

Fase de fundação (F0): monorepo, regras de preço e reserva, SQLite nativo e o harness de agentes de IA estão prontos. Login e cadastro ainda são os do gerador, então **não use com dados reais nem exponha por túnel ainda**. Fases e critérios de saída estão no [ROADMAP](docs/ROADMAP.md).

### Início rápido

Requisitos: Node.js 24, pnpm 11.20.0, Bun 1.4.2 e, só para o app desktop, Rust com os pré-requisitos do Tauri v2 (no Windows, a toolchain MSVC).

```bash
pnpm install
```

Crie `apps/server/.env` (`BETTER_AUTH_SECRET` e `DATABASE_FILE` com caminho absoluto local; mantenha `PORT` em 3000, a porta que o proxy do Vite e o app Tauri esperam, e deixe `CANONICAL_ORIGIN` vazia até existir o Tunnel) a partir do `apps/server/.env.schema` versionado e aplique as migrations:

```bash
pnpm db:migrate
```

Se o pnpm global ainda for 10.x e não conseguir trocar para a 11.20.0, instale a 11.20.0 pelo script oficial; veja as [falhas conhecidas](docs/HARNESS.md#8-falhas-silenciosas-conhecidas).

### Desenvolvimento

```bash
pnpm dev          # web em localhost:3001, com proxy de /api e /rpc para a API em 127.0.0.1:3000
pnpm build && pnpm --filter server start   # SPA e API num único processo em 127.0.0.1:3000
cd apps/web && pnpm desktop:dev   # app desktop Tauri, com pnpm dev:server rodando
```

Verificação, os mesmos comandos que o CI roda no Ubuntu 24.04 e no Windows:

```bash
pnpm harness:check && pnpm docs:check && pnpm harness:test
pnpm test && pnpm check && pnpm check-types && pnpm build
```

Banco de dados: `pnpm db:generate` gera o SQL da migration para revisão, `pnpm db:migrate` aplica pelo executor Bun e `pnpm db:push` só vale para banco descartável.

### Estrutura do projeto

A árvore de pastas é a mesma da seção [Project Structure](#project-structure).

### Documentação

Comece pelo [índice da documentação](docs/README.md): PRD, ROADMAP, SPEC, glossário e ADRs.

### Desenvolvimento com agentes de IA

O repositório traz um harness para Claude Code (padrão) e Codex:

- [AGENTS.md](AGENTS.md) com invariantes e regras por área;
- papéis e skills gerados a partir de uma fonte única;
- hooks de sessão que bloqueiam comandos inseguros e cobram atualização de docs e harness antes de encerrar;
- checagens que mantêm links, caminhos citados e rastreio de requisitos corretos.

Cada entrega segue `/entrega-iniciar`, `/verificar`, `/entrega-fechar` e `/integrar-branch`. Detalhes em [docs/HARNESS.md](docs/HARNESS.md).

### Contribuindo

1. Leia o [AGENTS.md](AGENTS.md) e o [ROADMAP](docs/ROADMAP.md).
2. Crie uma branch por entrega e siga TDD.
3. Mantenha todos os comandos de verificação verdes e atualize as docs curadas na mesma mudança.
4. Escreva commits em inglês no padrão conventional commits.

### Licença

Distribuído sob a [licença MIT](LICENSE).

# Costura Pro

Gestão local-first para um único ateliê de costura: atendimento e medidas, orçamentos, ordens de serviço e de produção, venda de produtos prontos, estoque, finanças e documentos não fiscais em A4 e 80 mm. Roda num PC Windows ou Ubuntu 24.04 e no celular como PWA, inclusive sem internet.

> **Estado: fundação (F0).** Scaffold, regras de preço sugerido e reserva e SQLite nativo estão prontos. Login e cadastro ainda são os genéricos do gerador. Não use com dados reais nem exponha pelo Cloudflare Tunnel antes das fases indicadas no [ROADMAP](docs/ROADMAP.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [PRD](docs/PRD.md) | Produto, requisitos, critérios de aceitação e registro de decisões |
| [ROADMAP](docs/ROADMAP.md) | Fases, spikes, critérios de saída e definição de pronto |
| [SPEC](docs/SPEC.md) | Contratos de engenharia e estado atual versus previsto |
| [CONTEXT](CONTEXT.md) | Glossário do domínio |
| [ADRs](docs/adr/) | Decisões difíceis de reverter |
| [HARNESS](docs/HARNESS.md) | Como trabalhar com agentes de IA (Claude Code, Codex) |
| [REFERENCIAS](docs/REFERENCIAS.md) | Versões, alternativas descartadas e fontes |

## Requisitos

- Node.js 24
- pnpm 11.20.0 (fixado em `packageManager`)
- Bun 1.4.2 no `PATH`
- Rust e os pré-requisitos do Tauri v2, só para o app desktop
- Windows 10 ou 11, ou Ubuntu 24.04 LTS

## Primeiros passos

```bash
pnpm install
```

Se o pnpm global ainda for 10.x e reclamar que não consegue trocar para a versão 11.20.0, instale o 11.20.0 pelo script oficial; veja [HARNESS §7](docs/HARNESS.md#7-falhas-silenciosas-conhecidas).

Crie os arquivos de ambiente a partir dos schemas versionados (`apps/server/.env.schema` e `apps/web/.env.schema`):

| Arquivo | Variáveis |
|---|---|
| `apps/server/.env` | `BETTER_AUTH_SECRET` (32 caracteres ou mais), `BETTER_AUTH_URL`, `CORS_ORIGIN`, `DATABASE_FILE` (caminho absoluto local) |
| `apps/web/.env` | `VITE_SERVER_URL` |

Aplique as migrations no banco apontado por `DATABASE_FILE`:

```bash
pnpm db:migrate
```

## Desenvolvimento

```bash
pnpm dev          # web em localhost:3001 e API em localhost:3000
pnpm dev:web
pnpm dev:server
cd apps/web && pnpm desktop:dev   # app Tauri
```

A separação entre web e API em portas diferentes é provisória: a F0 do ROADMAP passa a servir tudo numa única origem em loopback.

## Verificação

```bash
pnpm test
pnpm check-types
pnpm check        # pnpm fix corrige lint e formatação
pnpm build
pnpm harness:check
```

## Banco de dados

- `pnpm db:generate` gera o SQL de migration a partir do schema, para revisão.
- `pnpm db:migrate` aplica as migrations com o executor Bun.
- `pnpm db:local` cria e migra um `local.db` descartável no pacote de banco.
- `pnpm db:push` serve apenas para banco descartável; banco com dados reais muda só por migration.

## Estrutura

```
costura-pro/
├── apps/
│   ├── web/          # SPA React (TanStack Router, Vite, PWA)
│   │   └── src-tauri/  # app desktop Tauri v2
│   └── server/       # Hono, oRPC, Better Auth, evlog (Bun)
├── packages/
│   ├── api/          # roteadores oRPC e contexto
│   ├── auth/         # configuração do Better Auth
│   ├── config/       # tsconfig base
│   ├── db/           # schema Drizzle, migrations e SQLite nativo
│   ├── domain/       # regras puras de domínio
│   └── ui/           # componentes shadcn/ui e estilos
├── docs/             # PRD, ROADMAP, SPEC, HARNESS, REFERENCIAS, adr/
└── scripts/          # gerador e checador do harness de agentes
```

## Interface

Componentes compartilhados vivem em `packages/ui` (tokens em `packages/ui/src/styles/globals.css`). Para adicionar um componente ao pacote compartilhado:

```bash
npx shadcn@latest add dialog -c packages/ui
```

```tsx
import { Button } from "@costura-pro/ui/components/button";
```

## Variáveis de ambiente

Cada app declara seu ambiente em `.env.schema` (versionado); os `.env` ficam fora do git. O Varlock gera `src/env.ts` na instalação; depois de alterar um schema, rode `pnpm env:generate`. O carregamento automático de `.env` do Bun está desligado em `bunfig.toml`.

## Agentes de IA

Claude Code é a ferramenta padrão; Codex e clientes que leem `.agents/` usam portas geradas. Comece por [AGENTS.md](AGENTS.md) e [docs/HARNESS.md](docs/HARNESS.md).

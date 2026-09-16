# Referências (uso interno)

| Campo | Valor |
|---|---|
| Para que serve | Versões fixadas, alternativas descartadas, fontes externas e origem das decisões do [PRD](PRD.md) |
| Levantamento | 2026-09-16 |
| Atenção | Cita caminhos e repositórios locais do dono. Não compartilhar fora do projeto |

## Sumário

1. [Stack e versões](#1-stack-e-versões)
2. [Alternativas descartadas](#2-alternativas-descartadas)
3. [Documentação externa](#3-documentação-externa)
4. [Origem das decisões](#4-origem-das-decisões)
5. [Harnesses de referência](#5-harnesses-de-referência)

## 1. Stack e versões

Fonte de verdade: `package.json` de cada pacote, catálogo em `pnpm-workspace.yaml`, `pnpm-lock.yaml` e `bts.jsonc`. Para saber a versão atual, leia esses arquivos; esta tabela registra o que estava fixado em 2026-09-16.

| Camada | Tecnologia | Versão |
|---|---|---|
| Gerador | Better-T-Stack (`create-better-t-stack`) | 3.43.1 |
| Gerenciador de pacotes | pnpm (`packageManager`) | 11.20.0 |
| Runtime do servidor e testes | Bun | 1.4.2 |
| Scripts do harness | Node.js | 24 |
| Monorepo | Turborepo | ^2.10.12 |
| Linguagem | TypeScript | ^6.0.3 |
| Lint e formatação | Biome com Ultracite | 2.5.12 e 7.11.0 |
| Git hooks | Lefthook | latest |
| Servidor HTTP | Hono | ^4.13.7 |
| API tipada | oRPC | ^1.15.0 |
| Autenticação | Better Auth | 1.7.3 |
| ORM | Drizzle ORM e drizzle-kit | ^0.45.2 e ^0.31.10 |
| Banco | SQLite via `bun:sqlite` | do Bun |
| Validação | Zod | ^4.5.4 |
| Variáveis de ambiente | Varlock | 1.18.0 |
| Logs | evlog | ^2.28.1 |
| Frontend | React e React DOM | ^19.2.8 |
| Roteamento e dados | TanStack Router, Query e Form | ^1.170.32, ^5.102.8 e ^1.33.5 |
| Build web | Vite | ^8.2.2 |
| PWA | vite-plugin-pwa | ^1.3.0 |
| Estilo | Tailwind CSS | ^4.3.3 |
| Componentes | shadcn (sobre Base UI) | ^4.21.0 |
| Desktop | Tauri e CLI | 2.11.3 e ^2.11.4 |
| Espelho offline (previsto) | Dexie | a definir na F6 |
| Design system (previsto) | Storybook | a definir na F1 |

MCPs e skills do projeto estão em [HARNESS §2](HARNESS.md#2-matriz-ferramenta--artefato).

## 2. Alternativas descartadas

| Alternativa | Por que não | Onde está a decisão |
|---|---|---|
| libSQL e Turso (gerados pelo scaffold) | Cliente orientado a banco remoto, sem ganho para um PC | [ADR 0006](adr/0006-sqlite-nativo-bun.md) |
| `node:sqlite` dentro do Bun | Marcado como não implementado no Bun | [ADR 0006](adr/0006-sqlite-nativo-bun.md) |
| `drizzle-kit migrate` | Não executa migrations com `bun:sqlite`; procura `@libsql/client` ou `better-sqlite3` | [ADR 0006](adr/0006-sqlite-nativo-bun.md) |
| Playwright | O dono valida interface com browser-harness em navegador real | DEC-50 |
| Docker Desktop | Instalar e manter Docker num PC de ateliê | [ADR 0007](adr/0007-servico-do-so-e-tauri-administrativo.md) |
| Acesso pela LAN por HTTP ou DNS local | Service worker exige contexto seguro; dono sem acesso ao roteador | [ADR 0001](adr/0001-origem-canonica-e-local-first.md) |
| Cloudflare Access na frente do app | Complica instalação e sessão da PWA; o login do app com defesas basta | DEC-43 |
| Token de API da conta Cloudflare | Permissão ampla demais; basta o token do tunnel | DEC-46 |
| Cópia direta do arquivo SQLite em WAL | Não garante consistência; usar `VACUUM INTO` | [SPEC §6](SPEC.md#6-documentos-backup-restauração-e-atualização) |
| CSV na v1 | Fora do escopo; portabilidade pelo pacote de backup | DEC-04 |
| Wireframes HTML navegáveis | Descartados na migração para Windows; a interface nasce do design system | DEC-52 |
| Symlinks para espelhar skills | Viram arquivo de texto num clone Windows sem Developer Mode | [HARNESS §1](HARNESS.md#1-decisões-do-harness) |
| MCPs better-t-stack, better-auth e cloudflare-docs | Scaffold concluído; documentação coberta pelo context7 | DEC-53 |
| Skills turborepo, vercel-react-best-practices e review-logging-patterns | Pipeline estável; foco em Next.js; evlog já adotado | DEC-53 |

## 3. Documentação externa

Consultas feitas nas sessões de planejamento de 2026-09-15, salvo indicação.

| Assunto | Fonte |
|---|---|
| Service worker exige contexto seguro | [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) |
| Arquitetura e origem de PWA; isolamento no iOS | [web.dev: PWA architecture](https://web.dev/learn/pwa/architecture), [web.dev: detection](https://web.dev/learn/pwa/detection) |
| Política de armazenamento do WebKit | [WebKit: storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) |
| Tunnel remotamente gerenciado e token | [Cloudflare Tunnel: get started](https://developers.cloudflare.com/tunnel/get-started/), [local management](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/), [permissões do token](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/remote-tunnel-permissions/) |
| Backup online do SQLite | [SQLite: backup API](https://www.sqlite.org/backup.html) |
| SQLite no Bun e `node:sqlite` | [Bun: SQLite](https://bun.com/docs/runtime/sqlite), [Bun: node:sqlite](https://bun.com/reference/node/sqlite) |
| Executável standalone do Bun | [Bun: executables](https://bun.com/docs/bundler/executables) |
| Drizzle com Bun SQLite | [Drizzle: Bun SQLite](https://orm.drizzle.team/docs/get-started/bun-sqlite-new) |
| Updater do Tauri | [Tauri v2: updater](https://v2.tauri.app/plugin/updater/) |
| Better Auth: username, rate limit e hooks | [plugin Username](https://better-auth.com/docs/plugins/username), [rate limit](https://better-auth.com/docs/concepts/rate-limit), [hooks](https://better-auth.com/docs/concepts/hooks) |
| Better-T-Stack para agentes | [Better-T-Stack: agent workflows](https://www.better-t-stack.dev/docs/cli/agent-workflows) |
| Descoberta de skills, subagents e MCP no Claude Code (2026-09-16) | [skills](https://code.claude.com/docs/en/skills.md), [subagents](https://code.claude.com/docs/en/sub-agents.md), [MCP](https://code.claude.com/docs/en/mcp-configuration.md) |
| Subagentes e custo no Codex | [Codex: subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Codex: pricing](https://learn.chatgpt.com/docs/pricing) |

## 4. Origem das decisões

O projeto foi planejado e iniciado no Linux com Codex e trazido para Windows em 2026-09-16, sem o histórico git anterior. As conversas exportadas foram lidas e apagadas nessa data; o conteúdo durável está no [PRD §9](PRD.md#9-registro-de-decisões), nos ADRs e no [CONTEXT](../CONTEXT.md).

| Data | Sessão | Resultado |
|---|---|---|
| 2026-09-14 | Configuração do Codex | Superpowers e browser-harness instalados; Playwright descartado |
| 2026-09-14 e 2026-09-15 | Brainstorming do produto com perguntas estruturadas | Arquitetura serviço, PWA e Tauri; módulos da v1; direção visual |
| 2026-09-15 | Grill com glossário (a sessão registrou 134 decisões) | OS, OP e venda direta; reservas; custo provisório; cofre por dispositivo; origem canônica; backup com epoch; atualização coordenada; PRD, SPEC, CONTEXT e 5 ADRs |
| 2026-09-15 | Fundação | Scaffold, domínio de preço e reserva, revisão independente |
| 2026-09-15 | Wireframes | 26 telas HTML revisadas (descartadas em 2026-09-16) |
| 2026-09-15 | Harness Codex | Papéis explorer, reviewer e contract; limite de 2 subagentes |
| 2026-09-15 | Tarefa 0A | SQLite nativo com WAL, rejeição de caminho UNC, executor de migrations por Bun |
| 2026-09-16 | Reorganização (Claude Code) | Docs no molde do crm-ia-prd, ROADMAP, harness Claude-first, MCPs e skills enxutos |

Escolhas iniciais revistas durante o grill, marcadas como "Substituiu" no PRD: item independente por variação virou material base com variantes (DEC-19); baixa de estoque na aprovação virou reserva (DEC-20); "última alteração vence" virou conflito protegido (DEC-41); LAN principal virou origem canônica no Tunnel (DEC-42); sessão lembrada e cache cifrado por PIN viraram cofre com senha forte e PIN de tela (DEC-43); retenção de 7 diários ganhou 12 mensais (DEC-45).

## 5. Harnesses de referência

| Repositório local | O que foi aproveitado |
|---|---|
| `D:\Joseph\Desktop\DEV\crm-ia-prd` | Estrutura de PRD com registro de decisões, ROADMAP com spikes e critério de saída, HARNESS com veredito por artefato, AGENTS.md com regras de escrita e "quando uma decisão muda" |
| Takeflow (no Linux, `/home/joseph/Desktop/DEV/takeflow`) | Papéis de agente somente leitura (explorer, reviewer, contract) e checagem de deriva entre ferramentas |

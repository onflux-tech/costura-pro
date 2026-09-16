# Harness de agentes

| Campo | Valor |
|---|---|
| Para que serve | Guia para sessões de Claude Code (padrão), Codex e clientes genéricos: fontes, portas geradas, papéis, ciclo de entrega, evolução do harness, hooks, verificação e armadilhas |
| Atualizado | 2026-09-16 |
| Gerador e checagens | `scripts/harness.mjs` (`pnpm harness:sync`, `pnpm harness:check`), `scripts/docs-check.mjs` (`pnpm docs:check`) e `pnpm harness:test` |

## Sumário

1. [Decisões do harness](#1-decisões-do-harness)
2. [Matriz ferramenta × artefato](#2-matriz-ferramenta--artefato)
3. [Papéis e modelos](#3-papéis-e-modelos)
4. [Ciclo de entrega e evolução do harness](#4-ciclo-de-entrega-e-evolução-do-harness)
5. [Hooks do Claude Code](#5-hooks-do-claude-code)
6. [Verificação e CI](#6-verificação-e-ci)
7. [Antes de mexer em X, leia Y](#7-antes-de-mexer-em-x-leia-y)
8. [Falhas silenciosas conhecidas](#8-falhas-silenciosas-conhecidas)
9. [Registro de evolução](#9-registro-de-evolução)
10. [Sessão nova](#10-sessão-nova)

## 1. Decisões do harness

- **Claude Code é a ferramenta padrão.** Codex e clientes que leem `.agents/` continuam suportados pelas portas geradas, pelo `AGENTS.md`, pelo Lefthook e pelo CI.
- **Fontes únicas, portas geradas:**

| Fonte (editar aqui) | Porta gerada (nunca editar à mão) |
|---|---|
| `.agents/agents/<papel>/agent.md` e `ROLE_MODELS` em `scripts/harness.mjs` | `.claude/agents/<papel>.md` e `.codex/agents/<papel>.toml` |
| `.mcp.json` e `CODEX_SESSION` em `scripts/harness.mjs` | `.codex/config.toml` |
| `.agents/skills/` | `.claude/skills/` (cópia real, sem symlink) |

- **Escritos à mão, sem porta:** `AGENTS.md`, `CLAUDE.md` (importa o `AGENTS.md` com `@AGENTS.md` e guarda só o que é específico do Claude), `.claude/settings.json`, `.claude/hooks/` e `.claude/rules/`.
- **Sem symlink.** No Windows sem Developer Mode, um symlink versionado vira arquivo de texto num clone novo. `pnpm harness:check` acusa symlink (inclusive no diretório gerado), porta divergente, ausente ou sobrando; no pre-commit, `node scripts/harness.mjs check --staged` também exige as portas regeneradas no commit.
- **O que vai para o git:** `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `README.md`, `LICENSE`, `docs/` (com o índice `docs/README.md`), fontes, portas, hooks e rules. **Fica local:** `docs/superpowers/` (specs, planos e handoffs) e `.claude/settings.local.json`.
- **MCP mínimo:** `context7` (documentação de bibliotecas) e `shadcn` (registry de componentes), sem credencial versionada.
- **Skills:** as de processo genérico (Superpowers, grilling, domain-modeling, browser-harness) ficam globais na máquina do dono; o repositório vendoriza as skills da stack e guarda as skills de ciclo de entrega (§4).
- **Hooks só no Claude por enquanto** (§5). Codex é coberto pelas regras do `AGENTS.md`, pelo Lefthook e pelo CI.
- **Integração:** automática ao fim de cada entrega, com merge local na `main`, push e CI acompanhado, sem confirmação (autorização permanente do dono); não há PR.
- **Interface validada com browser-harness** em navegador real. Playwright não entra no projeto.
- **No máximo 2 subagentes por tarefa**, todos somente leitura.

## 2. Matriz ferramenta × artefato

| Artefato | Claude Code | Codex | Genérico |
|---|---|---|---|
| Instrução | `CLAUDE.md` (importa `AGENTS.md`) | `AGENTS.md` | `AGENTS.md` |
| Regras por área | `.claude/rules/*.md`, carregadas por `paths:` | Lista no `AGENTS.md` (ler a do caminho tocado) | Lista no `AGENTS.md` |
| Papéis | `.claude/agents/*.md` | `.codex/agents/*.toml` | `.agents/agents/<papel>/agent.md` |
| Skills | `.claude/skills/` (invocáveis como `/nome`) | `.agents/skills/` | `.agents/skills/` |
| Hooks de sessão | `.claude/settings.json` e `.claude/hooks/` | Não se aplica | Não se aplica |
| MCP | `.mcp.json`, habilitados em `.claude/settings.json` | `.codex/config.toml` | `.mcp.json` |
| Modelo principal | Escolhido na sessão | `gpt-5.6-terra`, esforço `medium` | Do cliente |
| Limite de subagentes | Regra do `AGENTS.md` (2) | `max_concurrent_threads_per_session = 2` | Regra do `AGENTS.md` (2) |
| Git e CI | Lefthook e `.github/workflows/ci.yml` | Idem | Idem |

**Skills vendorizadas da stack** (versões em `skills-lock.json`):

| Skill | Use quando |
|---|---|
| `analyze-logs` | Ler logs do evlog em `.evlog/logs/` sem subir servidor |
| `build-audit-logs` | Criar ou revisar trilha de auditoria com evlog |
| `better-auth-best-practices` | Configurar Better Auth, adapter e plugins |
| `better-auth-security-best-practices` | Rate limit, cookies, CSRF e origens confiáveis |
| `email-and-password-best-practices` | Política e hash de senha (a conta do dono usa username sobre a base de e-mail e senha) |
| `shadcn` | Adicionar, compor e estilizar componentes |
| `ultracite` | Padrões de código e correção de lint em TS e React |
| `vercel-composition-patterns` | Composição de componentes React 19 |
| `web-design-guidelines` | Revisão de interface e acessibilidade |

Para adicionar ou atualizar uma skill vendorizada, use a CLI `skills` (que mantém `skills-lock.json`) apontando para `.agents/skills/` e rode `pnpm harness:sync`.

## 3. Papéis e modelos

| Papel | Quando despachar | Claude | Codex |
|---|---|---|---|
| `explorer` | Mapear um fluxo desconhecido e devolver evidência com caminho e linha | `sonnet` | `gpt-5.6-luna`, `medium` |
| `reviewer` | Revisar diff importante: dinheiro, quantidade, dados, autenticação, offline | `opus` | `gpt-5.6-terra`, `high` |
| `contract` | Conferir produtor e consumidor entre web, API, domínio, banco, desktop e offline | `opus` | `gpt-5.6-terra`, `high` |

- Os três são somente leitura: no Claude, `tools: Read, Grep, Glob`; no Codex, `sandbox_mode = "read-only"`. O agente principal implementa e verifica.
- O `reviewer` no Claude não tem shell: entregue o diff salvo em arquivo e diga o caminho (a skill `revisar` faz isso).
- Cliente sem seleção de papel: passe o corpo de `.agents/agents/<papel>/agent.md` no despacho e informe modelo e esforço.
- Mudar modelo ou papel: edite `ROLE_MODELS` ou o `agent.md`, rode `pnpm harness:sync` e versione fonte e portas juntas.

## 4. Ciclo de entrega e evolução do harness

Toda implementação passa por quatro skills do projeto, fonte em `.agents/skills/`:

| Skill | Quando | O que garante |
|---|---|---|
| `/entrega-iniciar` | Começo de toda sessão de implementação | Entrega escolhida no ROADMAP, branch, rota (enxuta ou completa), spec local com DoD e mutações, rules da área lidas |
| `/verificar` | Antes de declarar pronto, commit ou integração | Bateria completa com saída em arquivo |
| `/revisar` | Entrega que toca dinheiro, quantidade, dados, autenticação, sync ou contrato entre camadas | `reviewer` e, se cruzar camadas, `contract`, com desafio de mutação |
| `/entrega-fechar` | Fim da implementação; o hook de Stop cobra | Verificação, docs curadas e índice atualizados, harness evoluído, handoff da próxima sessão e `/integrar-branch` em seguida |
| `/integrar-branch` | Automático no fim do `/entrega-fechar`, ou pedido do dono | Commits por área, merge local linear na `main`, push sem confirmação e CI acompanhado |

| Rota | Quando | Passos |
|---|---|---|
| Enxuta | Correção pequena, causa óbvia, sem mudar comportamento | TDD quando houver lógica, `/verificar`, `/entrega-fechar` |
| Completa | Entrega do ROADMAP, mudança de comportamento, regra de negócio ou contrato | `/entrega-iniciar`, brainstorming, spec, grilling, plano, TDD por checkpoint, `/revisar`, `/entrega-fechar` |

**Critérios de evolução** (aplicados no passo "Evoluir o harness" do `/entrega-fechar`):

| O que a entrega ensinou | Destino | Quem decide |
|---|---|---|
| Armadilha nova (falha silenciosa, gotcha de plataforma) | Linha na §8 e "Armadilhas conhecidas" da rule da área | Agente, direto |
| Convenção que se repete numa área | Rule em `.claude/rules/` com `paths:`, listada no `AGENTS.md` | Agente, direto |
| Área com conhecimento que não cabe numa rule | Doc em `docs/areas/<area>.md`, no índice `docs/README.md` | Agente, direto |
| Lente de revisão recorrente | "Armadilhas conhecidas" no corpo do papel em `.agents/agents/` | Agente, direto |
| Revisão que exige um olhar que nenhum papel cobre | Papel novo em `.agents/agents/` e `ROLE_MODELS` | Dono, pelo `AskUserQuestion` |
| Procedimento repetido em duas entregas | Skill nova em `.agents/skills/` | Dono, pelo `AskUserQuestion` |
| Documentação externa recorrente que o context7 não cobre | MCP no `.mcp.json`, sem credencial | Dono, pelo `AskUserQuestion` |
| Proibição que dá para bloquear mecanicamente | Regra no `.claude/hooks/guard.mjs` com teste de bloqueio e de falso positivo | Dono, pelo `AskUserQuestion` |

Toda mudança de harness entra na §9 com data e origem, e passa por `pnpm harness:sync`, `pnpm harness:check`, `pnpm docs:check` e `pnpm harness:test`.

## 5. Hooks do Claude Code

Configurados em `.claude/settings.json`. Cada script em `.claude/hooks/` exporta funções puras com teste `node:test` e nunca derruba a sessão por erro interno.

| Evento | Script | Faz |
|---|---|---|
| SessionStart | `session-start.mjs` | Foto do git da sessão (a primeira prevalece no resume), limpeza de sessões com mais de 7 dias e 3 a 5 linhas de contexto: branch, arquivos com mudança, harness divergente e lembrete do ciclo de entrega |
| PreToolUse (Bash, PowerShell, Edit, MultiEdit, Write) | `guard.mjs` | Bloqueia suíte de teste com pipe (inclusive `Select-Object`), kill geral de node, force-push em branch protegida (inclusive `--force-with-lease`, `-fu` e refspec com `+`), `--no-verify`, trailer `Claude-Session` e `Co-Authored-By`, `rm -rf` na raiz, `db:push`, travessão em commit, PR ou markdown do projeto, comentário novo em código (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, fora das skills vendorizadas e do próprio `.claude/hooks/guard.test.mjs`, cujos casos parecem comentário; `biome-ignore`, `@ts-expect-error` e `/// <reference` passam) e edição direta de porta gerada. Em Edit conta só o que a edição acrescenta, e em Write compara com o arquivo atual. Suíte, `db:push` e push são reconhecidos só no início de cada comando, então buscas como `grep db:push` passam |
| PostToolUse (Edit, MultiEdit, Write) | `format.mjs` | Só formata com `biome format` e avisa o modelo para reler quando o arquivo mudou; lint fica para o Lefthook e o `pnpm check` |
| PostToolUse (Bash, PowerShell, Edit, MultiEdit, Write) | `touch.mjs` | Registra arquivos tocados, inclusive os editados pelo shell |
| Stop | `stop-check.mjs` | Sobre o que a sessão mudou: cobra `/entrega-fechar` quando houve código sem docs curadas, e acusa harness divergente e falha do docs-check. Insiste duas vezes, libera na terceira e rearma, com uma cobrança só, quando as linhas de código dobram |

`session.mjs` guarda os utilitários comuns; o estado da sessão fica no diretório temporário do sistema, nunca no repositório. Não há hook de SessionEnd: o resume reaproveita o id da sessão e precisa da foto original.

## 6. Verificação e CI

| Quando | Comando |
|---|---|
| Antes de declarar pronto | `/verificar`: `pnpm harness:check`, `pnpm docs:check`, `pnpm harness:test`, `pnpm test`, `pnpm check`, `pnpm check-types`, `pnpm build` |
| Corrigir lint e formatação | `pnpm fix` |
| Mexeu em papéis, skills, MCP, hooks ou checagens | `pnpm harness:sync`, `pnpm harness:test`, `pnpm harness:check`; fonte e porta no mesmo commit |
| Mudou interface | browser-harness em desktop e 320 px, por toque e teclado |
| Mudou schema | `pnpm db:generate`, revisar o SQL, `pnpm db:migrate` contra banco temporário |

- **Lefthook no pre-commit:** biome e ultracite nos arquivos staged, `check --staged` do harness e `docs-check` em todo commit.
- **CI (`.github/workflows/ci.yml`):** roda em push na `main` e em pull request, no Ubuntu 24.04 e no Windows, com install congelado, `harness:check`, `docs:check`, `harness:test`, `check`, `check-types`, `test` e `build`.
- Rode a suíte redirecionando a saída para arquivo e leia o arquivo; o guard bloqueia pipe para `tail` ou `head`.

## 7. Antes de mexer em X, leia Y

| Antes de mexer em | Leia |
|---|---|
| Regra de negócio, estado ou cálculo | `CONTEXT.md`, [PRD §6 e §9](PRD.md), [SPEC §2 e §3](SPEC.md), ADRs 0002, 0003 e 0010, rule `.claude/rules/domain.md` |
| Banco, migrations ou `DATABASE_FILE` | [ADR 0006](adr/0006-sqlite-nativo-bun.md), [SPEC §2](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), rule `.claude/rules/db.md` |
| Sync, outbox, conflito ou epoch | [SPEC §4 e §5](SPEC.md#4-api-sincronização-e-conflito), ADRs 0001, 0003 e 0004 |
| Autenticação, cookies ou origem | [SPEC §5](SPEC.md#5-segurança-e-armazenamento-local), [ADR 0001](adr/0001-origem-canonica-e-local-first.md), rule `.claude/rules/server.md` |
| Documentos e PDF | [SPEC §6](SPEC.md#6-documentos-backup-restauração-e-atualização), [ADR 0008](adr/0008-documentos-emitidos-imutaveis.md) |
| Código documental ou identidade | [ADR 0009](adr/0009-uuid-e-codigo-documental-por-dispositivo.md) |
| Backup, restauração, instalador ou atualização | [SPEC §6 e §7](SPEC.md#7-empacotamento-observabilidade-e-testes), ADRs 0004, 0005 e 0007 |
| Interface | [PRD §6.1](PRD.md#61-primeira-experiência-e-navegação-rf-ent), RNF-03, RNF-04 e RNF-09, [ROADMAP F1](ROADMAP.md#f1-design-system-e-storybook), rule `.claude/rules/web.md` |
| Docs curadas e índice | [Índice](README.md), rule `.claude/rules/docs.md` |
| Papéis, skills, MCP, hooks ou checagens | §1 a §6 deste guia, rule `.claude/rules/harness.md` |
| Ordem do trabalho | [ROADMAP](ROADMAP.md): fase atual, spikes e critério de saída |

## 8. Falhas silenciosas conhecidas

| Sintoma | Causa | Como evitar |
|---|---|---|
| Claude não enxerga skills num clone Windows | Symlink versionado virou arquivo de texto sem Developer Mode | Portas são cópias geradas; `pnpm harness:check` acusa symlink |
| Codex ignora papéis, modelos e MCPs do projeto | Projeto não marcado como confiável | Confiar no projeto e conferir se os MCPs do projeto aparecem |
| Claude e Codex se comportam diferente depois de mudar papel ou MCP | Porta editada à mão, sync esquecido ou porta regenerada fora do commit | Editar só fontes; guard bloqueia edição de porta e o pre-commit roda `check --staged` |
| Regra do guard global do dono deixou de valer neste repositório | Com `.claude/hooks/guard.mjs` presente, o hook global não roda aqui | Regra global nova é copiada para o guard do projeto, com teste |
| Hook ou `.claude/settings.json` alterado parece não ter efeito | O Claude Code lê hooks no início da sessão | Abrir uma sessão nova depois de mudar hooks |
| Import recém-adicionado some antes do Edit que o usa | `biome check --write` aplica o fix seguro de `noUnusedImports` | O hook de format roda só `biome format` |
| Guard deixa passar tudo sem erro aparente | Hook chamado por junction, symlink ou `subst` não se reconhecia como ponto de entrada e saía com 0 | `isEntrypoint` compara `realpath` dos dois lados; teste chama o hook como processo |
| Workflow do CI é recusado e nenhum job roda | Contexto `runner` usado no `env` do job, onde ele não existe | Caminho do banco definido num step via `GITHUB_ENV` |
| Link para `harness.md` funciona no Windows e quebra no CI | Disco do Windows não diferencia maiúsculas | `pnpm docs:check` compara o nome exato de cada segmento |
| `pnpm docs:check` passa local e falha no CI com "caminho inexistente" de pasta de build | A pasta existe só na máquina que construiu, e padrão de `.gitignore` com barra final (`/target/`) não casa caminho ausente sem a barra | O docs-check consulta o `git check-ignore` com e sem barra final; conferir mudança de docs num clone limpo quando citar pasta gerada |
| `pnpm check` reprova tudo no CI Windows | Checkout em CRLF com biome formatando em LF | `.gitattributes` com `* text=auto eol=lf` |
| `pnpm install` num clone limpo (e no CI) falha com `Cannot find module './env'` em `packages/db/src/migrate.ts` | Os `src/env.ts` são gerados pelo `varlock codegen` e ignorados pelo git; o `tsc -b packages/api` do `postinstall` rodava antes da geração. Na máquina de quem já instalou, o arquivo antigo esconde o erro | `postinstall` gera os `env.ts` primeiro e compila depois; mudança no `postinstall` é conferida num clone limpo |
| Todo comando `pnpm` no projeto falha com "Failed to switch pnpm to v11.20.0 ... pnpm CLI is missing" | O pnpm global 10.x troca de versão instalando só o pacote de plataforma, mas o executável da 11.x precisa da pasta `dist/` ao lado ([pnpm/pnpm#12528](https://github.com/pnpm/pnpm/issues/12528)) | Instalar o pnpm 11.20.0 global pelo script oficial (no PowerShell: `$env:PNPM_VERSION="11.20.0"; iwr https://get.pnpm.io/install.ps1 -UseBasicParsing \| iex`) e abrir um terminal novo |
| No Windows, o varlock (no `postinstall`, no build de `apps/web` e em todo `pnpm run` ou `pnpm exec`, que reinstalam quando o `postinstall` falhou) gera os arquivos e aborta com `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` | O request de telemetria do varlock ainda está em voo quando o processo sai (Node 24 no Windows) | Telemetria do varlock desligada em `.varlock/config.json`, versionado; não remover. Também atende o RNF-08 |
| `bun: command not found` em comando não interativo | O PATH do shell interativo não foi carregado | Usar o caminho absoluto do Bun ou carregar o perfil do shell |
| Servidor não sobe depois de trazer o projeto de outra máquina | `.env` local ainda com `DATABASE_URL`, sem `DATABASE_FILE` | Definir caminho absoluto local em `apps/server/.env` |
| Migration não roda | `drizzle-kit migrate` não suporta `bun:sqlite` | `pnpm db:migrate` (executor Bun); `drizzle-kit` só gera SQL |
| `pnpm db:migrate` da raiz falha com "Cannot run interactive task ... without Terminal UI" quando roda por agente | A task do turbo é interativa e o shell do agente não tem TTY | Rodar direto no pacote: `pnpm --filter @costura-pro/db run db:migrate` |
| Dados de desenvolvimento somem | `db:push` contra banco com dados | Nunca `db:push` em banco real; o guard bloqueia |
| Arquivo do banco continua travado no Windows depois de fechar a conexão (`EBUSY`) | `close()` do `bun:sqlite` adia o fechamento enquanto há statements do Drizzle abertos | `closeDb` usa `close(true)`; todo código que troca o arquivo do banco fecha por ele |
| WAL trava ou corrompe | Banco em compartilhamento de rede | Caminho local; o validador rejeita UNC |
| Login não persiste em Safari e no Tauri de macOS e Linux via `http://127.0.0.1` | WebKit e libsoup descartam cookie `Secure` (e `SameSite=None`) vindo de HTTP; o scaffold forçava os dois | Better Auth com `useSecureCookies: false`; o servidor acrescenta `Secure` só no Host canônico (`apps/server/src/origin.ts`) |
| Better Auth manda `Secure` em todo Host ou em nenhum | O cálculo de `Secure` e do prefixo `__Secure-` acontece uma vez por instância; a `baseURL` dinâmica não muda isso | Middleware por Host, não configuração do Better Auth |
| Sessão de outro app em `localhost` cai ao entrar no Costura Pro, ou o contrário | Cookie não isola por porta; dois apps com Better Auth usam `better-auth.session_token` | `advanced.cookiePrefix: "costura-pro"` |
| `Set-Cookie` reescrito num middleware do Hono volta ao original | Atribuir `c.res` faz o Hono recopiar os `Set-Cookie` da resposta anterior | Editar `c.res.headers` no lugar |
| Servidor atende pelo IP da LAN embora `server.hostname` diga `localhost` | Bun sem `hostname` escuta em todas as interfaces | `hostname: "127.0.0.1"` literal; o teste de produção confere a tabela de sockets |
| `PORT` do `.env` é ignorada e o servidor sobe na 3000 | O Bun lê `PORT` só do ambiente do início do processo; o valor injetado pelo varlock chega tarde | `port: env.PORT` explícito no export |
| `pnpm --filter server start` sobe sem SPA | `NODE_ENV` já definido no ambiente vence o `--env-file=production.env` | Não exportar `NODE_ENV` no shell; o teste de produção remove a variável do processo filho |
| SPA 404 só no Linux | `serveStatic` com `path` absoluto e sem `root` vira caminho relativo no `join` posix | `root` absoluto com `path: "index.html"` |
| Cliente web lança `Invalid URL` ou `Invalid base URL` | oRPC 1.15 faz `new URL(url)` sem base; Better Auth rejeita `baseURL` relativa | `new URL("/rpc", window.location.origin)` e `createAuthClient()` sem `baseURL` |
| Com a PWA instalada, navegar para `/api` ou `/rpc` abre a SPA | `NavigationRoute` do Workbox sem denylist | `navigateFallbackDenylist` no `apps/web/vite.config.ts`, igual às exclusões do `apps/server/src/web.ts` |
| Proxy do Vite casa rota da SPA ou manda Host trocado | Chave sem `^` faz `startsWith`; o atalho string força `changeOrigin: true` | Chave regex e forma objeto com `changeOrigin: false` |
| Allowlist de Host e `Secure` falham só pelo Tunnel | `httpHostHeader` preenchido no painel da Cloudflare troca o Host que chega | Deixar `httpHostHeader` vazio (assistente da F7) |
| `tauri dev` cai com `EBUSY` no Windows durante a compilação | O watcher do Vite observa `apps/web/src-tauri/target` | `server.watch.ignored: ["**/src-tauri/**"]` |
| Browser-harness preenche formulário com credenciais do dono | Autofill do perfil do Chrome junta o texto salvo ao digitado | Verificar em contexto isolado (`Target.createBrowserContext`) |
| CDP do WebView2 não abre com `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` | O Tauri define os argumentos do navegador da janela | Build de verificação com `additionalBrowserArgs` na janela via `tauri build --config` fora do repositório |
| `netstat` não mostra `LISTENING` no Windows em português | O estado vem traduzido (`ESCUTANDO`) | Filtrar por porta local e remoto terminado em `:0`, sem depender do estado |
| `pnpm install` muda o lockfile sem mudança de dependência | `lefthook: latest` no `package.json` raiz é re-resolvido | Restaurar o lockfile, aplicar só a mudança e validar com `pnpm install --frozen-lockfile` |
| Dados do celular "somem" no iPhone | Safari e ícone instalado têm armazenamentos separados | Usar sempre a instância instalada; o assistente avisa |
| Formatação do hook diferente de `pnpm check` | `pnpm dlx ultracite` baixava outra versão | Lefthook usa `pnpm exec ultracite` |
| Sessão de agente trava por tempo indefinido | Saída da suíte de teste passada por `tail` ou `head` | Redirecionar para arquivo; o guard bloqueia |
| `tauri build` falha com "The default value `com.tauri.dev` is not allowed" | Identificador de exemplo do scaffold em `apps/web/src-tauri/tauri.conf.json` (Q-08, F7) | Até a F7, verificar com `tauri build --no-bundle --config <arquivo fora do repositório>` e identificador temporário |

## 9. Registro de evolução

| Data | Mudança | Origem |
|---|---|---|
| 2026-09-15 | Papéis `explorer`, `reviewer` e `contract` com checagem de deriva | Sessão Codex no Linux |
| 2026-09-16 | Portas geradas sem symlink, MCPs context7 e shadcn, 3 skills vendorizadas removidas, modelos por papel no Claude | Reorganização da documentação |
| 2026-09-16 | Hooks de sessão, rules por área, skills de ciclo de entrega, índice de docs com `docs-check`, CI em Ubuntu e Windows, merge local sem PR | Pedido do dono de harness evolutivo, inspirado na takeflow e no newticket-go |
| 2026-09-16 | Código sem comentários no `AGENTS.md` e guard barrando comentário novo em código | Pedido do dono durante a entrega F0 Mesma origem |
| 2026-09-16 | Armadilhas de origem, cookie, Bun, Vite, Tauri e verificação em navegador na §8 e nas rules de servidor e web; "Armadilhas conhecidas" nos papéis `reviewer` e `contract` | Fechamento e revisão da entrega F0 Mesma origem |
| 2026-09-16 | `/integrar-branch` roda sozinho no fim do `/entrega-fechar`, com push sem confirmação (DEC-58) | Pedido do dono ao integrar a F0 Mesma origem |

## 10. Sessão nova

Abra o cliente na raiz do repositório (`claude` ou `codex`) e comece por `/entrega-iniciar`. Prompt sugerido:

> Leia AGENTS.md e docs/ROADMAP.md e rode /entrega-iniciar para a próxima entrega pendente da fase atual. Siga a rota indicada e feche com /entrega-fechar; a integração com /integrar-branch roda sozinha em seguida.

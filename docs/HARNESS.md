# Harness de agentes

| Campo | Valor |
|---|---|
| Para que serve | Guia para sessões de Claude Code (padrão), Codex e clientes genéricos: fontes, portas geradas, papéis, ciclo de entrega, evolução do harness, hooks, verificação e armadilhas |
| Atualizado | 2026-09-18 |
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
| `contract` | Conferir produtor e consumidor entre web, API, domínio, banco e offline | `opus` | `gpt-5.6-terra`, `high` |

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

**Orçamento de subagentes** (2 por tarefa, contando pesquisa e revisão): entrega com código reserva o orçamento para o `/revisar`. Entrega só documental que registra contrato revisa inline, sem subagente, com DoD por grep e desafio de mutação no `docs:check`; o `/revisar` com `reviewer` e `contract` fica para a entrega que implementa o contrato.

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
| PreToolUse (Bash, PowerShell, Edit, MultiEdit, Write) | `guard.mjs` | Bloqueia suíte de teste com pipe (inclusive `Select-Object`), kill geral de node, force-push em branch protegida (inclusive `--force-with-lease`, `-fu` e refspec com `+`), `--no-verify`, trailer `Claude-Session` e `Co-Authored-By`, mensagem de commit que cita fase (F0 a F7), spike (S1 a S6 ou a palavra), spec, plano ou ID `DEC-`, `RF-` ou `Q-` (inclusive via `-F`; `spec.json` passa), arquivo de código ou migration com fase ou spike como segmento do nome (`f2-...`, `..._s5_...`), `rm -rf` na raiz, `db:push`, travessão em commit, PR ou markdown do projeto, comentário novo em código (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, fora das skills vendorizadas e do próprio `.claude/hooks/guard.test.mjs`, cujos casos parecem comentário; `biome-ignore`, `@ts-expect-error` e `/// <reference` passam) e edição direta de porta gerada. Em Edit conta só o que a edição acrescenta, e em Write compara com o arquivo atual. Suíte, `db:push` e push são reconhecidos só no início de cada comando, então buscas como `grep db:push` passam |
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
- **CI (`.github/workflows/ci.yml`):** roda em push na `main` e em pull request, no Ubuntu 24.04 e no Windows.
  - Sempre, direto no Node e antes de qualquer install: `node scripts/harness.mjs check`, `node scripts/docs-check.mjs` e os testes de `scripts` e `.claude/hooks` (os mesmos comandos de `harness:check`, `docs:check` e `harness:test`).
  - Bateria pesada (install congelado, `check`, `check-types`, `test` e `build`) só quando `scripts/ci-scope.mjs` acha no intervalo do push, de `github.event.before` a `github.sha`, ou da base do pull request, algum arquivo fora de `docs/**`, `*.md` e `.claude/rules/**`.
  - Push forçado, `before` zerado, outro evento, intervalo vazio ou falha do `git diff` rodam tudo; o checkout usa `fetch-depth: 0` para o `before` existir no clone.
- Rode a suíte redirecionando a saída para arquivo e leia o arquivo; o guard bloqueia pipe para `tail` ou `head`.

## 7. Antes de mexer em X, leia Y

| Antes de mexer em | Leia |
|---|---|
| Regra de negócio, estado ou cálculo | `CONTEXT.md`, [PRD §6 e §9](PRD.md), [SPEC §2 e §3](SPEC.md), ADRs 0002, 0003 e 0010, rule `.claude/rules/domain.md` |
| Banco, migrations ou `DATABASE_FILE` | [ADR 0006](adr/0006-sqlite-nativo-bun.md), [SPEC §2](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), rule `.claude/rules/db.md` |
| Sync, outbox, conflito ou epoch | [SPEC §4 e §5](SPEC.md#4-api-sincronização-e-conflito), ADRs 0001, 0003, 0004, 0013 e 0014 |
| Agregado de negócio novo ou comando de agregado | [Agregados](areas/agregados.md), [SPEC §2 a §4](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), [ADR 0014](adr/0014-anonimizacao-redige-historico-de-sincronizacao.md), rules `.claude/rules/db.md` e `.claude/rules/server.md` |
| Modelos de medidas, medições ou unidade de medida | [ADR 0015](adr/0015-medidas-em-milimetros-e-medicao-autocontida.md), [SPEC §2 e §4](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), [Agregados](areas/agregados.md), rules `.claude/rules/domain.md` e `.claude/rules/web.md` |
| Peça recebida, fotos, arquivos de mídia ou coleta | [ADR 0016](adr/0016-midia-enderecada-por-conteudo.md), [Mídia](areas/midia.md), [Agregados](areas/agregados.md), [SPEC §2 e §4](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), rules `.claude/rules/server.md`, `.claude/rules/db.md` e `.claude/rules/web.md` |
| Material, variante, unidade base, dinheiro ou quantidade em qualquer camada | [ADR 0010](adr/0010-dinheiro-e-quantidade-inteiros.md), [ADR 0017](adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md), [Catálogo de materiais](areas/catalogo.md), [SPEC §2 e §4](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), rules `.claude/rules/domain.md`, `.claude/rules/db.md`, `.claude/rules/server.md` e `.claude/rules/web.md` |
| Fornecedor, compra, rateio, obrigação, conta ou movimento financeiro | [Compras](areas/compras.md), [Finanças](areas/financas.md), [ADR 0019](adr/0019-compra-e-obrigacao-como-fatos-imutaveis.md), [Estoque](areas/estoque.md), [SPEC §2 a §4](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), rules `.claude/rules/domain.md`, `.claude/rules/db.md`, `.claude/rules/server.md` e `.claude/rules/web.md` |
| Serviço, custo, preço praticado, meta de margem ou preço sugerido | [Serviços](areas/servicos.md), [ADR 0020](adr/0020-servico-versionado-e-preco-sugerido-na-leitura.md), [Agregados](areas/agregados.md), [SPEC §2 a §4](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), rules `.claude/rules/domain.md`, `.claude/rules/server.md` e `.claude/rules/web.md` |
| Autenticação, cookies, origem ou acesso local | [SPEC §5](SPEC.md#5-segurança-e-armazenamento-local), ADRs [0001](adr/0001-origem-canonica-e-local-first.md) e [0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md), rule `.claude/rules/server.md` |
| Documentos e PDF | [SPEC §6](SPEC.md#6-documentos-backup-restauração-e-atualização), [ADR 0008](adr/0008-documentos-emitidos-imutaveis.md) |
| Código documental ou identidade | [ADR 0009](adr/0009-uuid-e-codigo-documental-por-dispositivo.md) |
| Backup, restauração, instalador ou atualização | [SPEC §6 e §7](SPEC.md#7-empacotamento-observabilidade-e-testes), ADRs 0004, 0005 e 0011 |
| Interface | [Design system](areas/design-system.md), [PRD §6.1](PRD.md#61-primeira-experiência-e-navegação-rf-ent), RNF-03, RNF-04 e RNF-09, [ROADMAP F1](ROADMAP.md#f1-design-system), rule `.claude/rules/web.md` |
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
| Roteiro de navegador grava acento deformado e o app parece quebrado | O heredoc do browser-harness chega ao Python com o encoding do console do Windows, e o texto sai trocado antes de virar `Input.insertText` ou corpo de `fetch` | Comparar nome acessível por trecho ASCII e, quando o dado precisar de acento, escapar em \uXXXX dentro do JavaScript, que o navegador interpreta. O app não tem esse problema: a suíte do servidor grava o nome acentuado e passa |
| Dinheiro ou quantidade negativa sai com a parte decimal também negativa (`R$ -12,-50`) | `formatMoney` e `formatQuantity` dividiam e tiravam o resto do valor com sinal | Separar o sinal antes de formatar; a primeira área com valor negativo é o estoque, então o defeito ficou latente desde o catálogo |
| Reescrita automática de arquivo duplica o escape do `ESCAPE` do `LIKE` e a consulta estoura em tempo de execução | Script de edição em massa processa a contrabarra mais uma vez | Conferir o literal depois de qualquer reescrita e o texto final com `.toSQL()` |
| `pnpm db:migrate` da raiz falha com "Cannot run interactive task ... without Terminal UI" quando roda por agente | A task do turbo é interativa e o shell do agente não tem TTY | Rodar direto no pacote: `pnpm --filter @costura-pro/db run db:migrate` |
| Dados de desenvolvimento somem | `db:push` contra banco com dados | Nunca `db:push` em banco real; o guard bloqueia |
| Arquivo do banco continua travado no Windows depois de fechar a conexão (`EBUSY`) | `close()` do `bun:sqlite` adia o fechamento enquanto há statements do Drizzle abertos | `closeDb` usa `close(true)`; todo código que troca o arquivo do banco fecha por ele |
| WAL trava ou corrompe | Banco em compartilhamento de rede | Caminho local; o validador rejeita UNC |
| Login não persiste em Safari e em navegadores WebKit do Linux via `http://127.0.0.1` | WebKit e libsoup descartam cookie `Secure` (e `SameSite=None`) vindo de HTTP; o scaffold forçava os dois | Better Auth com `useSecureCookies: false`; o servidor acrescenta `Secure` só no Host canônico (`apps/server/src/origin.ts`) |
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
| Browser-harness preenche formulário com credenciais do dono | Autofill do perfil do Chrome junta o texto salvo ao digitado | Verificar em contexto isolado (`Target.createBrowserContext`) |
| `netstat` não mostra `LISTENING` no Windows em português | O estado vem traduzido (`ESCUTANDO`) | Filtrar por porta local e remoto terminado em `:0`, sem depender do estado |
| Teste de "mesma saída para chaves em outra ordem" passa sem testar nada | `pnpm fix` (regra `useSortedKeys`) reordena as chaves dos objetos literais dos dois lados | Montar os objetos com `JSON.parse` e conferir o teste depois do `fix` |
| Login local responde 429 durante verificação manual | Toda requisição local cai no mesmo balde do rate limit (5 por 60 s, sucesso também conta) | Esperar 60 s ou usar outro processo com banco novo; nunca afrouxar a regra |
| Teste "Unhandled error between tests" com oRPC | Chamadas disparadas num array e aguardadas uma a uma rejeitam antes do `await` | Guardar funções e rodar com `inSequence` (`apps/server/tests/support.ts`) |
| `pnpm install` muda o lockfile sem mudança de dependência | `lefthook: latest` no `package.json` raiz era re-resolvido, também com `--lockfile-only` | `lefthook` fixo em `2.1.12` desde 2026-09-16; ao atualizar, trocar a versão fixa e conferir o diff do lockfile |
| Dados do celular "somem" no iPhone | Safari e ícone instalado têm armazenamentos separados | Usar sempre a instância instalada; o assistente avisa |
| Formatação do hook diferente de `pnpm check` | `pnpm dlx ultracite` baixava outra versão | Lefthook usa `pnpm exec ultracite` |
| Sessão de agente trava por tempo indefinido | Saída da suíte de teste passada por `tail` ou `head` | Redirecionar para arquivo; o guard bloqueia |
| Interface do PC perde sessão, service worker e cache | Origem é esquema, host e porta: `localhost` e `127.0.0.1`, ou outra `PORT`, são origens diferentes com armazenamento próprio | Abrir sempre `http://127.0.0.1:<PORT>`; a porta definitiva sai do S5 e não muda depois do primeiro instalador (DEC-59) |
| Rota administrativa atende requisição que veio pelo Tunnel | O `cloudflared` conecta ao servidor pelo loopback, então o IP do socket é `127.0.0.1` também para o celular | Acesso local pelo Host de loopback sem `cf-connecting-ip`, nunca pelo IP do socket ([ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md)) |
| Repetição de comando direto executa o efeito de novo | O `opId` era gravado numa transação separada do efeito, e uma falha entre as duas deixava o efeito sem registro | `runDirectCommand` só aceita handler que devolve `record(tx, resultado)` de dentro da transação do efeito |
| Duas chamadas simultâneas com o mesmo `opId` executam o efeito duas vezes | A trava em processo consultava o mapa, esperava com `await` e só então registrava a promessa | Fila por `opId` que encadeia e registra a promessa de forma síncrona (`packages/api/src/operations.ts`) |
| Depois de uma falha no cadastro do dono, nenhum cadastro passa mais | O adapter do Better Auth grava usuário e conta sem transação; o usuário órfão conta para o hook de usuário único | Apagar usuários sem conta `credential` na falha e reconciliar a instalação no boot |
| Tentativas de login remoto em paralelo passam do bloqueio | A contagem de falhas só mudava depois da resposta do Better Auth | Reservar a tentativa numa transação antes de chamar o Better Auth e acertar pela resposta (`packages/api/src/sign-in-guard.ts`) |
| `pnpm check` acusa `Bun` não declarado em teste | O Biome reconhece só globais de navegador e Node | APIs `node:*` equivalentes em vez de `Bun.*` |
| Backup do serviço falha numa pasta que o dono escolheu e enxerga no Explorer | Serviço do Windows não vê letra de unidade mapeada da sessão do usuário e, com conta virtual, não grava em pasta do perfil sem ACL | Navegador de pastas alimentado pelo servidor, rede só por UNC e teste de gravação e releitura no wizard (SPEC §5) |
| Classe de tamanho de fonte ou de cor some do elemento sem erro | O `cn` (merge de classes) trata `text-<nome>` desconhecido como cor; `text-body` e `text-danger-foreground` se anulam | Tamanho novo só com nome "de camiseta" (`text-2xs`, `text-md`) |
| Foco por teclado sem anel visível, embora a classe `focus-visible:outline-2` esteja lá | No Tailwind 4, `outline-none` zera `--tw-outline-style` e a largura sozinha herda "none" | `focus-visible:outline-solid` junto; `packages/ui/tests/focus-ring.test.ts` e `apps/web/tests/tokens.test.ts` barram |
| Página rola na horizontal em 320 px sem nenhum elemento largo visível | Lista com `overflow-x-auto` soma a largura do conteúdo ao tamanho intrínseco da grade da raiz | `contain-inline-size` na lista rolável e `grid-cols-[minmax(0,1fr)]` na grade do `__root` |
| Fontes somem com o app offline | `globPatterns` do Workbox sem `woff2` | Padrão `**/*-latin-{wght,opsz}-normal-*.woff2`; conferir as fontes no `dist/sw.js` |
| Aviso de chunk acima de 500 kB volta ao build | Devtools importados estaticamente no `__root` ou vendor grande no chunk de entrada | Devtools por import dinâmico sob `import.meta.env.DEV` e React no grupo `react` do `codeSplitting` |
| Menu do Base UI parece não abrir, não focar ou não fechar no browser-harness | Aba em segundo plano segura animações e `requestAnimationFrame`; em dev o botão dos devtools do React Query cobre a barra inferior | `activate_tab` antes de testar teclado e esconder o overlay dos devtools antes de clicar |
| Texto com acento some, não é encontrado ou é gravado corrompido ("AteliÃª") num roteiro do browser-harness | O heredoc passado ao harness chega lido como Latin-1, tanto na expressão JavaScript quanto no texto digitado | Roteiro num arquivo `.py` em UTF-8 carregado com `open(caminho, encoding="utf-8")`; localizar por estrutura (`form label`, `data-slot`) quando der |
| Edição em lote com `git grep` pula componentes novos | `git grep` só vê arquivos versionados | `grep -r` enquanto os arquivos ainda não estão no índice |
| Tela só de desenvolvimento aparece no build e no precache da PWA | `beforeLoad` com `notFound()` protege a rota em tempo de execução, mas o chunk continua no bundle e no `globPatterns` | Import dinâmico sob `import.meta.env.DEV` (`apps/web/src/routes/catalogo.tsx`); conferir o `dist` por texto da tela |
| Passo do CI que devia rodar sem dependências demora e instala tudo | O `pnpm run` do pnpm 11 instala as dependências antes do script quando não há `node_modules` | Passos leves chamam `node` direto; o `package.json` guarda os mesmos comandos para uso local |
| CI roda a bateria completa num push só de docs | Checkout raso não tem o commit `before`, o `git diff` falha e o `scripts/ci-scope.mjs` cai no caminho seguro | `fetch-depth: 0` no checkout; o passo Scope escreve o motivo da decisão no log |
| Push só de docs logo depois de um push com código deixa o código sem CI completo | `concurrency` com `cancel-in-progress` cancela a execução anterior da mesma ref | Esperar o CI do push com código terminar antes de enviar o próximo |
| Teste de login falha só no CI com "Cannot use a closed database" e erro de JSON | O teste estourou os 5 s padrão do `bun test` (hash de senha real repetido é lento em runner compartilhado) e o `afterEach` fechou o banco com requisições em curso | Teste com muitos logins reais recebe limite próprio (`manySignInsTimeoutMs` em `apps/server/tests/sign-in.test.ts`); para reproduzir, `bun test --timeout 1500` no arquivo |
| Dezenas de testes do servidor estouram 5 s só no `windows-latest`, com o Ubuntu verde e a suíte local normal | Runner Windows lento naquela execução: todo tipo de requisição fica de 3 a 7 vezes mais lento, inclusive código que o push não tocou (em 2026-09-18 o passo Tests levou 6 min contra 1 a 2 min, e a reexecução do mesmo commit passou em 2 min) | Antes de mexer em código ou em limite de teste, compare a duração do passo Tests e a latência por rota (`in Nms` do log) com a execução anterior; lentidão uniforme se confirma com `gh run rerun <id> --failed` no mesmo commit |
| Clique e toque do browser-harness estouram 5 s e nada acontece na página | Janela do contexto isolado no Chrome do dono encoberta: `document.visibilityState` fica `hidden` e o Chrome não confirma eventos de entrada | Chrome headless próprio com perfil no scratchpad e `BU_CDP_URL=http://127.0.0.1:9333` (rule de web) |
| Toast "Não foi possível carregar os dados" repetido com o servidor fora do ar | Consulta de guarda de rota ou de estado da conexão sem `meta: { silent: true }` cai no toast global do `QueryCache` a cada tentativa | `meta.silent` nas consultas que já têm tela própria de erro (`apps/web/src/lib/installation-queries.ts`, `apps/web/src/shell/use-server-connection.ts`) |
| Redirecionamento aberto passa em todos os testes | A função `safeRedirect` testada não era chamada pela rota, e a checagem por regex aceitava `/	/host` | Alvo do redirect calculado por função testada (`loginRedirect`) e `safeRedirect` com `new URL` e recusa de espaço, controle e barra invertida |
| Aviso `no output files found for task @costura-pro/ui#check-types` no `pnpm check-types` | A tarefa genérica declara `dist/**` como saída, mas o pacote só roda `tsc --noEmit` | Override da tarefa do pacote com `outputs: []` no `turbo.json` |
| Link com aparência de botão é anunciado como botão | `Button` do Base UI com `render` não nativo acrescenta `role="button"` | `ButtonLink` (`useRender` com as classes do botão) |
| Teste de varredura verde com cor, elemento ou emoji novos | Regex presa a uma lista fechada ou a uma linha só | Padrões genéricos (tom numérico de qualquer paleta, JSX em várias linhas, `Emoji_Presentation` e sequências) e desafio de mutação a cada regra nova |
| Contagem vinda de subconsulta sempre 0, sem erro | Subconsulta correlacionada em `sql` no `select` do Drizzle sai com colunas sem a tabela (`"client_id" = "id"`) | Alias e colunas qualificadas em SQL literal; conferir com `.toSQL()` (rule de banco) |
| Dado pessoal volta a um aparelho depois de anonimizar | Snapshots do `change_log`, valores de `sync_conflict` e `op_hash` e `current` de `operation` guardam cópias fora da linha viva | Redação na mesma transação e trigger que só libera `data` de agregado em `redacted_aggregate` ([ADR 0014](adr/0014-anonimizacao-redige-historico-de-sincronizacao.md), [agregados](areas/agregados.md)) |
| Leitor de tela lê "Nomeobrigatório" | Rótulo e marcador sem nó de texto entre eles; margem não entra no nome acessível | Espaço literal no `FieldLabel`; conferir nomes pela árvore de acessibilidade |
| Texto em bloco numa célula de `DataList` alinhado à direita no desktop | `md:text-inherit` é cor no Tailwind 4, e o conteúdo ficava num `span` com `text-right` | `div` com `md:[text-align:inherit]` no `DataListCell` |
| Campo ou alerta focado some atrás da barra inferior do celular | `MobileNav` sticky não entra na conta do scroll do foco | `max-md:scroll-pb-20` no `html` do `globals.css` |
| Captura do browser-harness estoura 60 s no Chrome headless próprio | Aba anexada em segundo plano não renderiza | `activate_tab(current_tab())` no começo do roteiro (rule de web) |
| Operação que chega pelo push depois de anonimizar guarda o telefone em hash invertível | A redação roda uma vez, e o push gravava o hash real das operações tardias e das resoluções de conflito | `op_hash` `redacted` no push para agregado redigido, `aggregateAnonymized` e criação sem pai; `sync.resolve` grava o agregado do conflito (rule de servidor) |
| Valores anonimizados ainda aparecem com `strings` no arquivo do banco | Página reescrita deixa o conteúdo antigo em espaço livre, e o WAL guarda os quadros velhos | `secure_delete` na abertura e `wal_checkpoint(TRUNCATE)` depois de anonimizar, com teste nos bytes (rule de banco) |
| Formulário de edição perde o que foi digitado ao voltar para a janela | Refetch por foco trocava a versão e o `key` do formulário remontava o componente | Congelar a versão aberta e trocar só por "Carregar versão atual" (rule de web) |
| Servidor atualizado não sobe com `no such table: measurement_template` | O boot semeia os modelos de medidas e `createDb` não migra | `pnpm --filter @costura-pro/db run db:migrate` antes de subir o servidor num banco existente (rule de servidor) |
| Formulário de medidas some com o que foi digitado quando a conexão oscila | Refetch em segundo plano com falha preenche `query.error` com os dados em cache, e a tela bloqueava por erro | Bloquear só por erro sem dados (`blockingError`), congelar a escolha padrão e manter ids de criação na página (rule de web) |
| Hash invertível de medida em operação que nunca virou linha | Quarentena por `invalidEnvelope`, `invalidPayload` ou edição de id inexistente guardava o hash real, e a redação só alcança agregado existente | Hash redigido para toda quarentena de comando de agregado com dado pessoal, procurado pelo nome (rule de servidor) |
| Varredura de dado pessoal não acha valor que está no banco | `JSON.stringify` da linha escapa as aspas do JSON das colunas, e dígito solto aparece em UUID | Ler valores crus com `.values()` e procurar padrão com contexto (`"valueMm":\d`) (rule de banco) |
| Teste de componentes reprova tela nova sem elemento nativo | Prop própria chamada `title` casa com a regra que barra o atributo `title=` | Outro nome de prop (`heading`) (rule de web) |
| Coleta de mídia leva quase 4 s com 2000 fotos e segura o servidor | O conjunto de referências era recalculado para cada candidata, e um `NOT EXISTS` correlacionado com `json_each` continuou lento | Conjunto único em `UNION` com `NOT IN`, `setImmediate` entre candidatas e teste de volume abaixo de 1 s ([mídia](areas/midia.md)) |
| Hash de foto aparece no log quando a leitura do arquivo falha | Rota Hono fora do oRPC sem `try`/`catch` cai no `errorHandler` padrão, que imprime o erro com o caminho | Falha tratada na rota com log só do `code` e teste que confere o log (rule de servidor) |
| Arquivo de mídia fora da subpasta certa nunca é coletado | A varredura achava o arquivo e a remoção usava o caminho recalculado pelo hash | Remover pelo caminho achado; o teste de produção cria um órfão fora do lugar ([mídia](areas/midia.md)) |
| Data com ano de cinco dígitos chega ao servidor e volta como `BAD_REQUEST` genérico | `fill_input` do browser-harness em `input type="date"` digita por cima do valor | Setter nativo de `value` no roteiro e recusa "Data inválida" na tela para valor fora de `AAAA-MM-DD` (rule de web) |
| `sync.push` devolve 500 num conflito de edição de agregado com dinheiro ou quantidade | O `sync_conflict` grava o payload já parseado, e `JSON.stringify` de `bigint` lança | Payload com valor devolve string canônica; só o store converte para `bigint` ([ADR 0017](adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md), rule de servidor) |
| Valor `"12,50"` num campo de dinheiro derruba a procedure com `SyntaxError` em vez de `BAD_REQUEST` | `regex` e `refine` do mesmo schema zod rodam os dois, então o `refine` chamou `BigInt` num valor que o `regex` já reprovou | Validar a forma dentro do próprio `refine`, ou encadear com `pipe` (rule de servidor) |
| Foto da variante desaparece ao salvar qualquer outro campo | Hook inicializado com `variant.photo` antes da consulta resolver; `useState` não reinicializa | Montar o editor só com o registro carregado, com `key` na versão (rule de web) |
| `vite build` falha com "Unable to write the service worker file. 'EINVAL'" durante a verificação | O servidor de produção da verificação está servindo `apps/web/dist` e o Windows recusa a reescrita do `sw.js` | Parar o servidor da verificação antes de rodar `pnpm build` ou `pnpm check-types` |
| Varredura de dado pessoal falha num push aleatório, sem mudança relacionada | O teste procurava um trecho de 5 dígitos do telefone, e a sequência aparece por acaso dentro de um UUID ou hash do dump | Procurar o valor inteiro (11 dígitos do telefone) na varredura de tabelas e de bytes (rule de banco) |
| Comando de agregado novo no registro sem procedure direta passa em silêncio | `CreateCommandName` e `UpdateCommandName` barram procedure que cita comando inexistente, não o contrário | Revisão do par registro e router a cada agregado novo (papel `contract`) |
| Foto gravada some depois de uma falha de envio na tela de edição | O estado zerava a foto confirmada antes de enviar a nova, e o salvamento seguia liberado | Guardar a última confirmada e bloquear o salvamento enquanto houver foto pendente ou falhada (rule de web) |
| Roteiro do browser-harness "passa" sem ter clicado no botão | Clique em coordenada abaixo da dobra não faz nada e não levanta erro | `DOM.scrollIntoViewIfNeeded` antes de ler a caixa do nó; `Input.insertText` escreve do caret, então limpe o campo antes (rule de web) |
| Tela inteira cai no erro de rota ao abrir um diálogo, só no build de produção com "Base UI error #28" | `FieldHint` ou `FieldError` fora de um `Field`: o Base UI lança "FieldRootContext is missing" | Texto de apoio solto é `Text`; o código do erro de produção se traduz procurando `formatErrorMessage(<código>)` no pacote do Base UI (rule de web) |
| Leitor de tela anuncia todos os chips com o rótulo do grupo | `ChoiceChips` dentro de `Field`: cada `Radio` ganha `aria-labelledby` do `FieldLabel` | `Fieldset` com `FieldsetLegend` (rule de web) |
| Valor mal formatado (`"12,50"`) num payload responde 500 em vez de `BAD_REQUEST` | `refine` do objeto roda depois de outro `refine` reprovado (falha continuável no zod) e converte o texto cru | `whenShapeIsValid` no `refine` do objeto (rule de servidor) |
| Push inteiro responde 500 por causa de uma operação | Segundo id da operação igual ao `aggregateId` passa pelo `exists` e bate na chave primária dentro da transação | Conferir cada id do payload contra o `aggregateId` e o banco, e devolver `aggregateExists` (rule de servidor) |
| Trigger append-only some depois de uma migration que só acrescentou coluna | drizzle-kit recriou a tabela (copiar, apagar, renomear) em vez de `ALTER TABLE ... ADD`, e as triggers da migration custom foram junto | Conferir o SQL gerado e manter o teste de append-only da tabela (rule de banco) |
| Dinheiro lançado em dobro depois de fechar e reabrir o diálogo | Ids e `opId` sorteados na montagem do diálogo, e a resposta perdida não deixa rastro na tela | Rascunho por alvo e ação na página (`useDrafts`), descartado só no sucesso (rule de web) |
| Nenhuma sub-aba marcada numa página filha | A aba ativa casa por prefixo do `href`, e a página não morava abaixo do caminho da aba | Rota filha abaixo da coleção da aba (rule de web) |
| Mutação na ordem total, na varredura de miniaturas ou na redação por tipo sobrevive aos testes | Dados de teste iguais nos eixos que o código distingue: relógio real, miniatura com o hash da foto, tipo trocado por outro agregado pessoal | `manualClock`, hashes distintos e tipo sem dado pessoal (`installation`) nos testes (papel `reviewer`) |
| Teste de migration passa e a coluna nova apaga a linha da instalação num banco real | O drizzle-kit pode recriar a tabela (copiar, apagar e renomear) em vez de `ALTER TABLE ... ADD`, e o teste com banco novo não tem linha para perder | Migrar até a anterior por um journal cortado, inserir a linha e aplicar o resto (rule de banco) |
| `pnpm check` reprova formulário novo por complexidade cognitiva sem nenhuma lógica nova | Cada `Field` com dica e erro condicionais soma ternários no mesmo componente | Componente local de campo e `inputProps` (rule de web) |
| Pull de um banco migrado traz um agregado antigo sem o campo que a SPEC promete | A migration acrescenta a coluna, mas os snapshots do `change_log` foram gravados antes dela | O consumidor aplica o padrão do domínio, listado na SPEC §4 (rule de servidor) |
| Tela mostra "Margem 40%" junto do aviso "abaixo da meta" | A margem arredondada meio para cima alcança a meta que o preço não alcança | Margem arredondada para baixo ([serviços](areas/servicos.md)) |

## 9. Registro de evolução

| Data | Mudança | Origem |
|---|---|---|
| 2026-09-15 | Papéis `explorer`, `reviewer` e `contract` com checagem de deriva | Sessão Codex no Linux |
| 2026-09-16 | Portas geradas sem symlink, MCPs context7 e shadcn, 3 skills vendorizadas removidas, modelos por papel no Claude | Reorganização da documentação |
| 2026-09-16 | Hooks de sessão, rules por área, skills de ciclo de entrega, índice de docs com `docs-check`, CI em Ubuntu e Windows, merge local sem PR | Pedido do dono de harness evolutivo, inspirado na takeflow e no newticket-go |
| 2026-09-16 | Código sem comentários no `AGENTS.md` e guard barrando comentário novo em código | Pedido do dono durante a entrega F0 Mesma origem |
| 2026-09-16 | Armadilhas de origem, cookie, Bun, Vite, Tauri e verificação em navegador na §8 e nas rules de servidor e web; "Armadilhas conhecidas" nos papéis `reviewer` e `contract` | Fechamento e revisão da entrega F0 Mesma origem |
| 2026-09-16 | `/integrar-branch` roda sozinho no fim do `/entrega-fechar`, com push sem confirmação (DEC-58) | Pedido do dono ao integrar a F0 Mesma origem |
| 2026-09-16 | Armadilhas de origem local, acesso local pelo Tunnel e pasta de backup do serviço na §8 e na rule de servidor; orçamento de subagentes na §4 e no passo "Revisar" do `/entrega-fechar` | Fechamento da entrega Q-11 app desktop |
| 2026-09-16 | Regra de nomes sem fase nem spec em código, testes, migrations e commits (`AGENTS.md`, passo de commit do `/entrega-fechar` e bloqueio no guard para nome de arquivo e mensagem de commit, com testes); armadilhas de rate limit local, ordenação de chaves do `fix`, promessas em testes oRPC, Drizzle sobre `bun:sqlite`, migrations custom e mensagens do Better Auth nas rules de servidor, banco, web e domínio e na §8; armadilhas do ledger na mesma transação, fila por `opId`, usuário órfão do Better Auth, reserva de login, log de erro de procedure, HMAC de código curto e global `Bun` no Biome, vindas da revisão, na rule de servidor, na §8 e nos papéis `reviewer` e `contract` | Pedido do dono e fechamento da entrega de servidor de acesso e sync |
| 2026-09-16 | Armadilhas de Tauri e WebView2 removidas da §8 e da rule de web; papel `contract` sem desktop e com o proxy do Vite como exemplo de contrato; `src-tauri` fora do hook de format; armadilha do lockfile detalhada para remoção de dependência | Fechamento e revisão da entrega de remoção do app Tauri |
| 2026-09-16 | Doc de área `docs/areas/design-system.md` no índice; rule de web com componentes e tokens obrigatórios e armadilhas de `cn`, anel de foco, largura intrínseca, zoom do iOS, fontes offline, devtools e browser-harness; §8 com essas falhas e o `lefthook` fixo; regra de UI só com componentes e sem emoji no `AGENTS.md`, travada por teste | Pedido do dono e fechamento da entrega do design system |
| 2026-09-16 | Rule de web com `Link` tipado, `data-slot` do gatilho de menu, consultas silenciosas, `queryClient.query`, `Checkbox` com `Field.Label`, username normalizado no login, foco ao trocar de passo e Chrome headless para o browser-harness; §8 com janela oculta, acento corrompido no roteiro, toast repetido, redirecionamento aberto e aviso do turbo; armadilhas de redirect testado pela rota no `reviewer` e de chave do `opId` e literal de estado no `contract` | Revisão e fechamento da entrega das telas do wizard e do shell |
| 2026-09-16 | CI por caminho: `scripts/ci-scope.mjs` com teste decide a bateria pesada pelo intervalo do push; harness, docs e testes do harness rodam sempre direto no Node; §6 e §8 atualizadas; limite próprio para testes com muitos logins reais, achado no primeiro push da prova | Pedido do dono e fechamento da entrega de CI por caminho |
| 2026-09-17 | Doc de área `docs/areas/agregados.md` no índice e na §7; rules de banco, servidor e web com subconsulta do Drizzle, trigger de redação, `secure_delete`, comando em dois caminhos, dado pessoal fora da linha viva, mensagens compartilhadas, nome acessível do rótulo, alinhamento do `DataListCell`, barra inferior e foco, formulário congelado e roteiros do browser-harness; §8 com essas falhas; lentes de dado pessoal e de literal compartilhado nos papéis `reviewer` e `contract` | Revisão e fechamento da entrega de clientes e perfis |
| 2026-09-17 | §7 com modelos de medidas e ADR 0015; `agregados.md` com `updateCommands`, rejeição com mensagem, semeadura no boot, hash redigido por comando pessoal e varredura por valores crus; rules de domínio (medida em mm como `number`), servidor (hash em toda quarentena pessoal, schema idempotente no `keepLocal`, boot exige a migration), banco (coluna JSON e varredura) e web (bloqueio só sem dados, escolha padrão congelada, prop `title`, foco no campo inválido, `fill_input` e domínio `Fetch` do CDP no browser-harness); §8 com essas falhas; lentes de refetch com falha, quarentena por qualquer caminho e filho anonimizado no `reviewer`, e de teto de payload, schema idempotente e filtro de pendências no `contract` | Revisão e fechamento da entrega de modelos de medidas e medições |
| 2026-09-17 | Doc de área `docs/areas/midia.md` e ADR 0016 no índice e na §7; `agregados.md` com referências de mídia para agregado novo; rules de servidor (rota Hono fora do oRPC, `exclude` do evlog com controle positivo, `referencedHashes`, rotina periódica sem custo quadrático, `rename` no Windows, dependência do domínio, `manualClock`), banco (forma de `db.all` e `db.get`, `json_each` vazio, `NOT IN` com `NULL`), domínio (quantidade de peças como `number`) e web (data e arquivos no browser-harness, `Photo` com tamanho e ref, foto local sem baixar, captura com fallback, lib `DOM` nos testes, regra que depende de outra ação); §8 com essas falhas; lentes de dados de teste iguais, volume, log de rota crua e arquivo fora do lugar no `reviewer`, e de referências de mídia, status de rota crua e prop da regra de tela no `contract` | Revisão e fechamento da entrega de peça recebida e mídia |
| 2026-09-17 | Doc de área `docs/areas/catalogo.md` e ADR 0017 no índice e na §7; rules de banco (coluna inteira por `bigintInteger`, lista duplicada do domínio provada no servidor), domínio (precisão só de exibição, tupla antes do `Record`), servidor (payload sem `bigint`, `regex` e `refine` no mesmo schema, campo que o patch ignora) e web (hook inicializado por consulta, valor como string na tela, consulta por tecla, clique fora da dobra no browser-harness); §8 com essas falhas e com o `sw.js` travado pelo servidor da verificação | Revisão e fechamento da entrega do catálogo de materiais |
| 2026-09-18 | Docs de área `docs/areas/compras.md` e `docs/areas/financas.md` e ADR 0019 no índice e na §7; `agregados.md` com fato novo como transição, conferência de todo id do payload e `whenShapeIsValid`; rules de domínio (conta única entre servidor e prévia, estado derivado com precedência), banco (coluna nova em tabela append-only), servidor (`refine` de objeto, segundo id da operação, transição como fato) e web (`FieldHint` fora de `Field`, chips em `Fieldset`, diálogo fora do formulário, aba por prefixo, painel da linha, rascunho de diálogo que lança dinheiro, seletor sem paginação, chave do `opIdFor` com a data do clique, servidor de verificação com `exec` e papéis do browser-harness); §8 com essas falhas; lentes no `reviewer` (refine sobre valor cru, segundo id da operação, rateio com brinde, rascunho do diálogo) e no `contract` (payload da web no schema real, seletor paginado, `PRECONDITION_FAILED` por assunto, data no `opId`) vindas da revisão | Revisão e fechamento da entrega de compras e contas financeiras |
| 2026-09-18 | Doc de área `docs/areas/servicos.md` e ADR 0020 no índice e na §7; `agregados.md` com preferência do ateliê na instalação; rules de banco (coluna nova em tabela com linha provada por journal cortado e texto do `sqlite_master`), servidor (snapshot antigo sem campo novo no pull, preferência na instalação) e web (componente de campo contra a complexidade cognitiva do Biome); §8 com essas falhas e a margem arredondada a favor do aviso; lentes no `reviewer` (patch de um campo que o zod remove, pull conferido só no último snapshot, número que contradiz o aviso) e no `contract` (payload do diálogo fora da `lib`, campo novo em snapshot antigo) vindas da revisão | Revisão e fechamento da entrega de serviços e preço sugerido |

## 10. Sessão nova

Abra o cliente na raiz do repositório (`claude` ou `codex`) e comece por `/entrega-iniciar`. Prompt sugerido:

> Leia AGENTS.md e docs/ROADMAP.md e rode /entrega-iniciar para a próxima entrega pendente da fase atual. Siga a rota indicada e feche com /entrega-fechar; a integração com /integrar-branch roda sozinha em seguida.

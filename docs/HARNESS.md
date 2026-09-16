# Harness de agentes

| Campo | Valor |
|---|---|
| Para que serve | Guia para sessões de Claude Code (padrão), Codex e clientes genéricos: fontes, portas geradas, papéis, processo, verificação e armadilhas |
| Atualizado | 2026-09-16 |
| Gerador | `scripts/harness.mjs` (`pnpm harness:sync` e `pnpm harness:check`) |

## Sumário

1. [Decisões do harness](#1-decisões-do-harness)
2. [Matriz ferramenta × artefato](#2-matriz-ferramenta--artefato)
3. [Papéis e modelos](#3-papéis-e-modelos)
4. [Processo](#4-processo)
5. [Verificação](#5-verificação)
6. [Antes de mexer em X, leia Y](#6-antes-de-mexer-em-x-leia-y)
7. [Falhas silenciosas conhecidas](#7-falhas-silenciosas-conhecidas)
8. [Sessão nova](#8-sessão-nova)

## 1. Decisões do harness

- **Claude Code é a ferramenta padrão.** Codex e clientes que leem `.agents/` continuam suportados pelas portas geradas.
- **Fontes únicas, portas geradas:**

| Fonte (editar aqui) | Porta gerada (nunca editar à mão) |
|---|---|
| `.agents/agents/<papel>/agent.md` e `ROLE_MODELS` em `scripts/harness.mjs` | `.claude/agents/<papel>.md` e `.codex/agents/<papel>.toml` |
| `.mcp.json` e `CODEX_SESSION` em `scripts/harness.mjs` | `.codex/config.toml` |
| `.agents/skills/` | `.claude/skills/` (cópia real, sem symlink) |

- **Sem symlink.** No Windows sem Developer Mode, um symlink versionado vira arquivo de texto num clone novo e some em silêncio. `pnpm harness:check` acusa symlink (inclusive no próprio diretório gerado), porta divergente, ausente ou sobrando. No pre-commit, o Lefthook roda `node scripts/harness.mjs check --staged`, que também exige que as portas regeneradas estejam no commit.
- **`CLAUDE.md` é escrito à mão:** importa o `AGENTS.md` com `@AGENTS.md` e guarda só o que é específico do Claude Code.
- **O que vai para o git:** `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/` (PRD, SPEC, ROADMAP, HARNESS, REFERENCIAS e `adr/`), fontes e portas do harness. **Fica local:** `docs/superpowers/` (specs e planos de sessão) e `.claude/settings.local.json`. O porquê durável vai para ADR, PRD e corpo do PR.
- **MCP mínimo:** `context7` (documentação de bibliotecas) e `shadcn` (registry de componentes). Novo MCP só entra com uso recorrente comprovado e sem credencial versionada; documentação de biblioteca vai pelo context7.
- **Skills de processo ficam fora do repositório.** Superpowers, grilling, domain-modeling e browser-harness estão instaladas globalmente na máquina do dono. O repositório só vendoriza skills da stack.
- **Hooks de ferramenta não são versionados.** O dono mantém hooks globais no Claude Code; o projeto usa Lefthook para Git.
- **Interface é validada com browser-harness** em navegador real. Playwright não entra no projeto.
- **No máximo 2 subagentes por tarefa**, todos somente leitura.

## 2. Matriz ferramenta × artefato

| Artefato | Claude Code | Codex | Genérico |
|---|---|---|---|
| Instrução | `CLAUDE.md` (importa `AGENTS.md`) | `AGENTS.md` | `AGENTS.md` |
| Papéis | `.claude/agents/*.md` | `.codex/agents/*.toml` | `.agents/agents/<papel>/agent.md` |
| Skills da stack | `.claude/skills/` | `.agents/skills/` | `.agents/skills/` |
| MCP | `.mcp.json`, habilitados em `.claude/settings.json` | `.codex/config.toml` | `.mcp.json` |
| Modelo principal | Escolhido na sessão | `gpt-5.6-terra`, esforço `medium` | Do cliente |
| Limite de subagentes | Regra do `AGENTS.md` (2) | `max_concurrent_threads_per_session = 2` | Regra do `AGENTS.md` (2) |
| Pré-requisito | Aprovar os MCPs do projeto se o cliente pedir | Projeto marcado como confiável para carregar `.codex/` | Nenhum |

**Skills vendorizadas** (`.agents/skills/`, versões em `skills-lock.json`):

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

Para adicionar ou atualizar uma skill, use a CLI `skills` (a que mantém `skills-lock.json`) apontando para `.agents/skills/` e rode `pnpm harness:sync` em seguida. Se a CLI criar symlinks em `.claude/skills/`, o sync os troca por cópias.

## 3. Papéis e modelos

| Papel | Quando despachar | Claude | Codex |
|---|---|---|---|
| `explorer` | Mapear um fluxo desconhecido e devolver evidência com caminho e linha | `sonnet` | `gpt-5.6-luna`, `medium` |
| `reviewer` | Revisar diff importante: dinheiro, quantidade, dados, autenticação, offline | `opus` | `gpt-5.6-terra`, `high` |
| `contract` | Conferir produtor e consumidor entre web, API, domínio, banco, desktop e offline | `opus` | `gpt-5.6-terra`, `high` |

- Os três são somente leitura: no Claude, `tools: Read, Grep, Glob`; no Codex, `sandbox_mode = "read-only"`. O agente principal implementa e verifica.
- O `reviewer` no Claude não tem shell: entregue o diff como arquivo legível (por exemplo, `git diff` salvo num arquivo temporário) e diga o caminho.
- Delegue só tarefa independente e delimitada. Não gaste subagente com trabalho sequencial que o principal resolve lendo poucos arquivos.
- Cliente que não oferece seleção de papel: passe o corpo de `.agents/agents/<papel>/agent.md` no despacho e informe modelo e esforço explicitamente.
- Mudar modelo ou papel: edite `ROLE_MODELS` ou o `agent.md`, rode `pnpm harness:sync` e versione fonte e portas juntas.

## 4. Processo

| Rota | Quando | Passos |
|---|---|---|
| Enxuta | Correção pequena, causa óbvia, sem mudar comportamento | TDD quando houver lógica, verificação (§5), PR |
| Completa | Entrega do ROADMAP, mudança de comportamento, regra de negócio ou contrato | Brainstorming, spec local, grilling (com domain-modeling se termo ou ADR mudar), plano local, execução por checkpoints com TDD, review pelos papéis, verificação, PR |

- Perguntas ao dono vão pela ferramenta de pergunta do cliente (no Claude, `AskUserQuestion`), com a opção recomendada primeiro.
- Specs e planos de sessão ficam em `docs/superpowers/` (local). Não aponte para eles a partir de docs versionados.
- Quando uma decisão muda, siga a lista "Quando uma decisão muda" do [AGENTS.md](../AGENTS.md).

## 5. Verificação

| Quando | Comando |
|---|---|
| Antes de declarar pronto | Testes relevantes, `pnpm check-types`, `pnpm check`, `pnpm build` |
| Corrigir lint e formatação | `pnpm fix` |
| Testes de domínio e banco | `pnpm test` (Turborepo roda `bun test` em cada pacote) |
| Mexeu em papéis, skills, MCP ou gerador | `pnpm harness:sync`, `pnpm harness:test`, `pnpm harness:check`; fontes e portas no mesmo commit |
| Mudou interface | browser-harness em desktop e 320 px, por toque e teclado |
| Mudou schema | `pnpm db:generate`, revisar o SQL, `pnpm db:migrate` contra banco temporário |

Rode a suíte redirecionando a saída para arquivo e leia o arquivo; nunca passe a saída de testes por `tail` ou `head`.

## 6. Antes de mexer em X, leia Y

| Antes de mexer em | Leia |
|---|---|
| Regra de negócio, estado ou cálculo | `CONTEXT.md`, [PRD §6 e §9](PRD.md), [SPEC §2 e §3](SPEC.md), ADRs 0002, 0003 e 0010 |
| Banco, migrations ou `DATABASE_FILE` | [ADR 0006](adr/0006-sqlite-nativo-bun.md), [SPEC §2](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio), `packages/db/src/index.ts` |
| Sync, outbox, conflito ou epoch | [SPEC §4 e §5](SPEC.md#4-api-sincronização-e-conflito), ADRs 0001, 0003 e 0004 |
| Autenticação, cookies ou origem | [SPEC §5](SPEC.md#5-segurança-e-armazenamento-local), [ADR 0001](adr/0001-origem-canonica-e-local-first.md), skills `better-auth-*` |
| Documentos e PDF | [SPEC §6](SPEC.md#6-documentos-backup-restauração-e-atualização), [ADR 0008](adr/0008-documentos-emitidos-imutaveis.md) |
| Código documental ou identidade | [ADR 0009](adr/0009-uuid-e-codigo-documental-por-dispositivo.md) |
| Backup, restauração, instalador ou atualização | [SPEC §6 e §7](SPEC.md#7-empacotamento-observabilidade-e-testes), ADRs 0004, 0005 e 0007 |
| Interface | [PRD §6.1](PRD.md#61-primeira-experiência-e-navegação-rf-ent), RNF-03, RNF-04 e RNF-09, [ROADMAP F1](ROADMAP.md#f1-design-system-e-storybook), skills `shadcn` e `web-design-guidelines` |
| Papéis, MCP ou skills | §1 e §2 deste guia, `scripts/harness.mjs` |
| Ordem do trabalho | [ROADMAP](ROADMAP.md): fase atual, spikes e critério de saída |

## 7. Falhas silenciosas conhecidas

| Sintoma | Causa | Como evitar |
|---|---|---|
| Claude não enxerga skills num clone Windows | Symlink versionado virou arquivo de texto sem Developer Mode | Portas são cópias geradas; `pnpm harness:check` acusa symlink |
| Codex ignora papéis, modelos e MCPs do projeto | Projeto não marcado como confiável | Confiar no projeto e conferir se os MCPs do projeto aparecem |
| Claude e Codex se comportam diferente depois de mudar papel ou MCP | Porta editada à mão, sync esquecido ou porta regenerada fora do commit | Editar só fontes; o pre-commit roda `check --staged` |
| Todo comando `pnpm` no projeto falha com "Failed to switch pnpm to v11.20.0 ... pnpm CLI is missing" | O pnpm global 10.x troca de versão instalando só o pacote de plataforma, mas o executável da 11.x precisa da pasta `dist/` ao lado dele ([pnpm/pnpm#12528](https://github.com/pnpm/pnpm/issues/12528)) | Instalar o pnpm 11.20.0 global pelo script oficial (no PowerShell: `$env:PNPM_VERSION="11.20.0"; iwr https://get.pnpm.io/install.ps1 -UseBasicParsing \| iex`) e abrir um terminal novo |
| No Windows, o varlock (no `postinstall`, no build de `apps/web` e em todo `pnpm run` ou `pnpm exec`, que reinstalam quando o `postinstall` falhou) gera os arquivos e aborta com `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` | O request de telemetria do varlock ainda está em voo quando o processo sai (Node 24 no Windows) | Telemetria do varlock desligada em `.varlock/config.json`, versionado; não remover. Também atende o RNF-08 |
| `bun: command not found` em comando não interativo | O PATH do shell interativo não foi carregado | Usar o caminho absoluto do Bun ou carregar o perfil do shell |
| Servidor não sobe depois de trazer o projeto de outra máquina | `.env` local ainda com `DATABASE_URL`, sem `DATABASE_FILE` | Definir caminho absoluto local em `apps/server/.env` |
| Migration não roda | `drizzle-kit migrate` não suporta `bun:sqlite` | `pnpm db:migrate` (executor Bun); `drizzle-kit` só gera SQL |
| Dados de desenvolvimento somem | `db:push` contra banco com dados | Nunca `db:push` em banco real; sempre migration |
| Arquivo do banco continua travado no Windows depois de fechar a conexão (`EBUSY`) | `close()` do `bun:sqlite` adia o fechamento enquanto há statements do Drizzle abertos | `closeDb` usa `close(true)`; qualquer código que troque o arquivo do banco (restauração, testes) fecha por ele |
| WAL trava ou corrompe | Banco em compartilhamento de rede | Caminho local; o validador rejeita UNC |
| Sessão não persiste em localhost | Scaffold força `SameSite=None; Secure` em HTTP | Política de cookie por origem (F0 e F2) |
| Dados do celular "somem" no iPhone | Safari e ícone instalado têm armazenamentos separados | Usar sempre a instância instalada; o assistente avisa |
| Formatação do hook diferente de `pnpm check` | `pnpm dlx ultracite` baixava outra versão | Lefthook usa `pnpm exec ultracite` |
| Sessão de agente trava por tempo indefinido | Saída da suíte de teste passada por `tail` ou `head` | Redirecionar para arquivo |
| Instalador com identificador de exemplo | `com.tauri.dev` do scaffold em `apps/web/src-tauri/tauri.conf.json` | Definir o identificador antes do primeiro instalador (F7) |

## 8. Sessão nova

Abra o cliente na raiz do repositório (`claude` ou `codex`). Prompt sugerido:

> Leia AGENTS.md e docs/ROADMAP.md. Trabalhe na próxima entrega pendente da fase atual, seguindo docs/PRD.md, docs/SPEC.md e CONTEXT.md. Use a rota completa do docs/HARNESS.md para mudança de comportamento e feche com testes, `pnpm check-types`, `pnpm check` e `pnpm build`.

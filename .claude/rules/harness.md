---
paths:
  - ".agents/**"
  - ".claude/**"
  - ".codex/**"
  - "scripts/**"
  - ".mcp.json"
  - "lefthook.yml"
  - ".github/**"
  - "skills-lock.json"
---

# Harness de agentes

- Fontes: `.agents/agents`, `.agents/skills`, `.mcp.json` e `scripts/harness.mjs`. As portas `.claude/agents`, `.claude/skills` e `.codex` são geradas: edite a fonte e rode `pnpm harness:sync` (o guard bloqueia edição direta).
- Hooks em `.claude/hooks` são módulos puros com teste; regra nova precisa de caso de bloqueio e de falso positivo.
- Papel, skill, MCP ou hook que mudou atualiza o [docs/HARNESS.md](../../docs/HARNESS.md) na mesma mudança; o docs-check cobra papéis e skills.
- Verificação: `pnpm harness:test`, `pnpm harness:check` e `pnpm docs:check`; fonte e porta vão no mesmo commit.

## Armadilhas conhecidas

- Com `.claude/hooks/guard.mjs` presente, o guard global do dono não roda neste repositório: regra nova do guard global precisa ser copiada para cá.
- Mudança em `.claude/settings.json` ou nos hooks só vale numa sessão nova do Claude Code.
- Stop hook que sai com código 0 só fala com o modelo pelo JSON `decision: block`; texto solto não chega.
- Commit que toca `.claude/rules` roda a checagem do harness contra o que está no stage: com fonte de papel ou skill alterada e porta fora do stage, ele é recusado com "porta gerada fora do commit" mesmo depois do `pnpm harness:sync`. Commite fonte e portas antes do commit de docs, ou no mesmo.
- `git add -N`, usado para pôr os arquivos novos no diff salvo para o `reviewer`, deixa entradas "intent-to-add" no índice, e o `git stash create` do lefthook recusa o pre-commit com "Failed to save unstaged changes". Antes dos commits por área, desfaça com `git reset` misto, que mexe só no índice e preserva a árvore de trabalho.
- O Biome do repositório lê todo `.ts` da árvore, inclusive o que está fora do git (`vcs.useIgnoreFile: false` no `biome.json`): roteiro local guardado em `docs/superpowers/` reprova o `pnpm check`. Molde de roteiro fica em markdown, em bloco de código.

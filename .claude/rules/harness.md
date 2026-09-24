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
- Commit que tira arquivo do rastreio com `git rm --cached` apaga esse arquivo do disco em todo clone que recebe o commit por merge ou pull, inclusive no próprio ao voltar para a `main` e fazer o fast-forward. Tenha backup antes e restaure sem rastrear com `git restore --source=<commit anterior> --worktree -- <caminho>`.
- Edição feita por script (Node, `sed`) não passa pelo hook de formatação do Claude: ordem de import e quebra de linha só aparecem no `pnpm check`. Rode `pnpm exec biome check --write` nos arquivos tocados logo depois do script.
- Script com crase no texto (markdown, template literal) não vai em `node -e "..."` pelo Bash: o shell executa a crase como substituição de comando e o texto some sem erro. Escreva o script num arquivo `.cjs` pelo editor, ou por heredoc com o delimitador entre aspas simples, sem esse mesmo delimitador no corpo.
- Arquivo novo entra no diff da revisão por `git diff --no-index -- /dev/null <arquivo>`, anexado ao mesmo arquivo do diff e sem mexer no índice; o comando sai com código 1 quando há diferença, então não o encadeie com `&&`.

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
- `vite build`, `tsc` e o worker do plugin da PWA caem com "memory allocation of N bytes failed", "Zone Allocation failed" ou "Worker terminated due to reaching memory limit" quando a memória virtual da máquina chega ao limite (não há arquivo de paginação além da RAM, e servidores de desenvolvimento de outros projetos e o `tsserver` do editor ocupam gigabytes). Confira `FreeVirtualMemory` do `Win32_OperatingSystem` antes de culpar o código, repita quando houver folga e nunca derrube processo do dono; os passos de tipo do `check-types` (`tsc -b ../../packages/api`, `tsc --noEmit`, `tsc --noEmit -p tests`) rodam separados do `vite build` quando nenhuma rota nova precisa regenerar o `routeTree.gen.ts`.
- Script Python que regrava arquivo do repositório com `Path.write_text` no Windows troca LF por CRLF (o modo texto traduz `\n` para o fim de linha do sistema): o `pnpm check` reprova o arquivo inteiro. Grave com `write_bytes(texto.encode("utf-8"))` ou `open(caminho, "w", encoding="utf-8", newline="\n")`, e procure `\r` nos arquivos tocados antes do `pnpm check`.
- O roteiro de dados de exemplo roda duas vezes e cada comando repete o mesmo conteúdo pelo mesmo `opId`: `baseVersion` lida do banco na hora já subiu na segunda rodada e recebe "opId reutilizado com conteúdo diferente". Fixe no roteiro a versão que o registro tem na primeira rodada.

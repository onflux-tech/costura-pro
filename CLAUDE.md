@AGENTS.md

## Só para o Claude Code

- Papéis em `.claude/agents/`: `explorer` roda em sonnet; `reviewer` e `contract` rodam em opus. O `reviewer` não tem shell, então entregue o diff salvo num arquivo e passe o caminho.
- MCPs do projeto: `context7` para documentação de bibliotecas e `shadcn` para o registry de componentes, habilitados em `.claude/settings.json`.
- Skills da stack em `.claude/skills/` são cópias geradas de `.agents/skills/`.
- Escolhas e confirmações do dono vão por `AskUserQuestion`.

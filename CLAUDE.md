@AGENTS.md

## Só para o Claude Code

- Hooks em `.claude/settings.json`: o `guard` bloqueia comandos e edições proibidos, e o Stop cobra `/entrega-fechar` quando a sessão mexeu em código sem atualizar docs. Hook novo registrado no `settings.json` só vale numa sessão nova; o conteúdo de um script já registrado vale na chamada seguinte.
- Rules de `.claude/rules/` carregam sozinhas pelos `paths:` dos arquivos que você toca.
- Papéis em `.claude/agents/`: `explorer` roda em sonnet; `reviewer` e `contract`, em opus com esforço max; `implementer`, em opus com esforço high, é o único com escrita. O `reviewer` não tem shell, então entregue o diff salvo num arquivo e passe o caminho.
- MCPs do projeto: `context7` para documentação de bibliotecas e `shadcn` para o registry de componentes.
- Skills do projeto e da stack em `.claude/skills/` são cópias geradas de `.agents/skills/`.
- Escolhas e confirmações do dono vão por `AskUserQuestion`.

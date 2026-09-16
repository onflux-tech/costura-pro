---
paths:
  - "docs/**"
  - "*.md"
  - ".claude/rules/**"
  - ".agents/agents/**"
---

# Documentação curada

- Português do Brasil, datas absolutas e nenhum U+2014 ou U+2013; o guard e o `pnpm docs:check` barram. O `README.md` da raiz é bilíngue (EN/PT) por ser a página pública.
- Doc novo em `docs/` entra no índice [docs/README.md](../../docs/README.md); o docs-check reprova o que ficar fora.
- Link relativo, âncora e caminho entre crases precisam existir; renomeou um arquivo, atualize quem o cita.
- Requisito novo no PRD entra na tabela de rastreio do ROADMAP.
- Doc de área em `docs/areas/<area>.md`: header `**Files:**`, Overview, tabelas e links relativos, no padrão dos vizinhos.
- Specs, planos e handoffs ficam em `docs/superpowers/`, fora do git; doc versionado nunca aponta para eles.

## Armadilhas conhecidas

- No Windows o disco não diferencia maiúsculas: um link para `harness.md` "funciona" localmente e quebra no CI Linux. O docs-check compara o nome exato.

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

---
paths:
  - "apps/server/**"
  - "packages/api/**"
  - "packages/auth/**"
---

# Servidor, API e autenticação

- Contratos: [mesma origem](../../docs/SPEC.md#1-topologia-e-componentes), [sync](../../docs/SPEC.md#4-api-sincronização-e-conflito) e [conta e bootstrap](../../docs/SPEC.md#5-segurança-e-armazenamento-local).
- Valor monetário e quantidade saem no JSON como string decimal.
- Logs com evlog sem senha, token, medidas, fotos ou dados completos de cliente (RNF-08).
- Teste de integração com Hono autenticado e SQLite real; banco em memória não vale como evidência.
- Rotas de administração (backup, restauração, Tunnel, atualização, dispositivos e navegador de pastas) só pelo acesso local: Host de loopback, sem `cf-connecting-ip` e com sessão do dono ([ADR 0011](../../docs/adr/0011-servico-do-so-e-acesso-local-no-navegador.md)).
- Skills: `better-auth-best-practices`, `better-auth-security-best-practices`, `analyze-logs` e `build-audit-logs`.

## Armadilhas conhecidas

- Cookie `Secure` vindo de HTTP some no WebKit: o Better Auth roda com `useSecureCookies: false` e o `Secure` entra por Host canônico em `apps/server/src/origin.ts`; nunca volte a `defaultCookieAttributes` com `secure` ou `sameSite: "none"`.
- Middleware do Hono que mexe em `Set-Cookie` edita `c.res.headers` no lugar; atribuir `c.res` recopia os cookies antigos.
- O export do servidor mantém `hostname: "127.0.0.1"` e `port: env.PORT` explícitos: sem eles o Bun escuta em todas as interfaces e ignora a `PORT` do varlock.
- `serveStatic` usa `root` absoluto com `path` relativo; `path` absoluto sem `root` quebra só no Linux.
- Rota nova fora de `/api`, `/api-reference` e `/rpc` cai no fallback da SPA: prefixo novo de servidor entra na regex de `apps/server/src/web.ts` e na denylist do service worker.
- Em produção o rate limit padrão do Better Auth (3 requisições por 10 s em `/sign-in*` e `/sign-up*`) cai num bucket compartilhado sem IP (aviso no log): o `production.test.ts` já usa os 3 cadastros, e um quarto recebe 429. A F2 configura o IP pelo `cf-connecting-ip`.
- Com `NODE_ENV=test` o Better Auth desliga sozinho a checagem de Origin e CSRF: teste de `trustedOrigins` ou de CSRF roda contra o processo de produção (`apps/server/tests/production.test.ts`).
- `bun test` direto em `apps/server` usa o `dist` que existir; o `pnpm test` pelo turbo constrói servidor e web antes.
- Cadastro público fechado só na interface não basta: o servidor rejeita `sign-up` direto e concorrente.
- O `cloudflared` conecta pelo loopback: acesso local se decide pelo Host de loopback sem `cf-connecting-ip`, nunca pelo IP do socket.
- Serviço do Windows não enxerga letra de unidade mapeada da sessão do usuário: navegador de pastas e backup aceitam caminho local ou UNC e sempre testam gravação e releitura.

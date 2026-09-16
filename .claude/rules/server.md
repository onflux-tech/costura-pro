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
- Rotas de administração (backup, restauração, Tunnel, dispositivos) só pelo desktop local.
- Skills: `better-auth-best-practices`, `better-auth-security-best-practices`, `analyze-logs` e `build-audit-logs`.

## Armadilhas conhecidas

- O scaffold força `SameSite=None; Secure` até em localhost HTTP; a política de cookie é por origem.
- Cadastro público fechado só na interface não basta: o servidor rejeita `sign-up` direto e concorrente.

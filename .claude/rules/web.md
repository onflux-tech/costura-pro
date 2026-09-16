---
paths:
  - "apps/web/**"
  - "packages/ui/**"
---

# Web, PWA e interface

- Siga a skill `ultracite`. Componentes shadcn ficam em `packages/ui`, e os tokens em `packages/ui/src/styles/globals.css`.
- Toda tela funciona de 320 px ao desktop, por toque e teclado, com foco visível, contraste AA e nada dependente de hover (RNF-03, RNF-04).
- Antes de declarar pronto, valide em navegador real com browser-harness.
- API por caminho relativo (`/rpc`, `/api`); URL absoluta de servidor não entra no cliente.
- Custos internos e margens só em tela do dono, nunca em documento ou prévia para cliente.
- Skills: `shadcn`, `vercel-composition-patterns` e `web-design-guidelines`.

## Armadilhas conhecidas

- oRPC 1.15 e Better Auth não aceitam base relativa: `new URL("/rpc", window.location.origin)` e `createAuthClient()` sem `baseURL`.
- O proxy do Vite usa chave regex e `changeOrigin: false`.
- Verificação com browser-harness roda em contexto isolado (`Target.createBrowserContext`): o autofill do perfil do dono mistura credenciais salvas no formulário.
- O build avisa chunk acima de 500 kB no `apps/web`; divida por rota antes das telas reais.
- No iPhone, Safari e ícone instalado guardam dados separados: teste sempre na instância instalada.
- Mensagens de erro do Better Auth chegam em inglês: a tela traduz pelo status (401 e 429 no login) em vez de exibir `error.message`.

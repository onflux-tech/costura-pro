---
paths:
  - "apps/web/**"
  - "packages/ui/**"
---

# Web, PWA e interface

- Siga a skill `ultracite` e o [design system](../../docs/areas/design-system.md): tokens em `packages/ui/src/styles/globals.css`, componentes em `packages/ui/src/components`, estados no catálogo `/catalogo` (`pnpm dev:web`).
- Tela só com componentes e tokens do `packages/ui`: nada de `h1`, `p`, `span`, `button`, `input` ou outro elemento nativo com classes, nenhum `alert`, `confirm`, `prompt` ou atributo `title`, e nenhum emoji. Componente que falta nasce no `packages/ui`, com seus estados no catálogo. Os testes de `apps/web/tests` e `packages/ui/tests` barram os casos comuns; o que eles não renderizam (responsivo, teclado, toque) se confere no navegador.
- Toda tela funciona de 320 px ao desktop, por toque e teclado, com foco visível, contraste AA e nada dependente de hover (RNF-03, RNF-04).
- Antes de declarar pronto, valide em navegador real com browser-harness.
- API por caminho relativo (`/rpc`, `/api`); URL absoluta de servidor não entra no cliente.
- Custos internos e margens só em tela do dono, nunca em documento ou prévia para cliente.
- Skills: `shadcn`, `vercel-composition-patterns` e `web-design-guidelines`.

## Armadilhas conhecidas

- oRPC 1.15 e Better Auth não aceitam base relativa: `new URL("/rpc", window.location.origin)` e `createAuthClient()` sem `baseURL`.
- O proxy do Vite usa chave regex e `changeOrigin: false`.
- Tamanho de fonte novo precisa de nome "de camiseta" (`text-2xs`, `text-md`): o `cn` trata `text-<nome>` desconhecido como cor e apaga a classe de tamanho ou a de cor no merge.
- No Tailwind 4, `outline-none` zera `--tw-outline-style`, e `focus-visible:outline-2` sozinho não desenha anel. Use sempre `focus-visible:outline-2 focus-visible:outline-solid`.
- Lista com `overflow-x-auto` ainda soma a largura do conteúdo ao tamanho intrínseco dos pais e abre rolagem horizontal em 320 px. Use `contain-inline-size` na lista e `grid-cols-[minmax(0,1fr)]` na grade da raiz.
- Campo com texto abaixo de 16 px faz o Safari do iPhone dar zoom ao focar: o `Input` usa `text-base` abaixo de 768 px.
- Fonte empacotada só funciona offline se o `globPatterns` do Workbox incluir o `woff2`; o padrão atual guarda só os subconjuntos `latin` normais.
- Devtools do Router e do Query entram por import dinâmico sob `import.meta.env.DEV`; import estático leva os dois ao build de produção.
- Guarda de rota em tempo de execução não tira código do bundle: tela só de desenvolvimento (como o catálogo) entra por import dinâmico sob `import.meta.env.DEV`, senão vai para o build e para o precache da PWA.
- `Button` do Base UI com `render={<Link />}` vira `<a role="button">`: navegação com cara de botão usa `ButtonLink`.
- A barra inferior usa `env(safe-area-inset-bottom)`, que só vale com `viewport-fit=cover` no `index.html`; confira no iPhone com a PWA instalada.
- Verificação com browser-harness roda em contexto isolado (`Target.createBrowserContext`): o autofill do perfil do dono mistura credenciais salvas no formulário.
- Com a aba em segundo plano, animações e `requestAnimationFrame` do Base UI atrasam foco e fechamento de menu no browser-harness: use `activate_tab` antes de testar teclado.
- Em desenvolvimento, o botão flutuante dos devtools do React Query cobre o "Mais" da barra inferior: esconda o overlay antes de clicar.
- No iPhone, Safari e ícone instalado guardam dados separados: teste sempre na instância instalada.
- Mensagens de erro do Better Auth chegam em inglês: a tela traduz pelo status (401 e 429 no login) em vez de exibir `error.message`.

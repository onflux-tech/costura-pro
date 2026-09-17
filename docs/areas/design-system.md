# Design system

**Files:** `packages/ui/src/styles/globals.css`, `packages/ui/src/components/`, `packages/ui/src/lib/navigation.ts`, `packages/ui/tests/`, `apps/web/src/lib/destinations.ts`, `apps/web/src/catalog/`, `apps/web/src/routes/catalogo.tsx`, `apps/web/tests/`

## Overview

A identidade "ateliê contemporâneo" (RNF-09) nasceu no Claude Design em 2026-09-16, com 12 telas de referência em 1440 e 390 px (ver [REFERENCIAS §3](../REFERENCIAS.md#3-documentação-externa)). O `packages/ui` guarda os tokens e os componentes; o `apps/web` monta telas só com eles. O catálogo `/catalogo`, que existe só em desenvolvimento, mostra cada componente com os estados que aparecem nas telas e é a referência viva para quem cria uma tela nova. Não há Storybook nem tema escuro ([PRD DEC-66 a DEC-68](../PRD.md#97-engenharia-e-processo)).

Os testes seguram as regras:

| Teste | O que reprova |
|---|---|
| `packages/ui/tests/contrast.test.ts` | Par de token de texto abaixo de 4,5:1, borda de campo ou indicador abaixo de 3:1, bloco `.dark`, `--color-*` do `@theme inline` apontando para outro token, e `bg-*` com `text-*` na mesma string de componente abaixo de 4,5:1 |
| `packages/ui/tests/focus-ring.test.ts` | Linha com `outline-none`, `outline-hidden` ou `focus-visible:outline-2` sem `focus-visible:outline-2 focus-visible:outline-solid`, `focus:outline-*` no lugar de `focus-visible`, e `outline-ring` em componente sobre a barra verde |
| `packages/ui/tests/no-emoji.test.ts` | Emoji, diálogo nativo e `title=` no `packages/ui/src` |
| `apps/web/tests/tokens.test.ts` | Qualquer paleta do Tailwind com tom numérico, `black` e `white`, hexadecimal, funções de cor, valor arbitrário fora de `grid-cols` e `grid-rows`, `style={{`, anel incompleto, inclusive em `.css`; e cor do tema da PWA e do navegador diferente dos tokens |
| `apps/web/tests/components.test.ts` | Elemento nativo de texto, lista, tabela, mídia ou controle, `<Link` com `className` ou `activeProps`, diálogo nativo, atributo `title` e emoji (bandeiras e keycaps inclusive; `©` e `→` passam) |
| `packages/ui/tests/navigation.test.ts` e `apps/web/tests/destinations.test.ts` | Destino fora de lugar, repetido ou em grupo inexistente, conferido sobre os destinos reais em cada largura |

Nenhum teste renderiza componente: responsividade, teclado e toque continuam validados com browser-harness.

## Tokens

Valores em hexadecimal no `:root`, expostos pelo `@theme inline` como `bg-*`, `text-*` e `border-*`.

| Grupo | Tokens | Uso |
|---|---|---|
| Superfície | `background` `#f7f4ee`, `card` e `popover` branco, `muted` `#f2efe8`, `accent` `#eef4e7` | Fundo creme, cartões, fundos neutros, tag de código e item de menu em foco |
| Texto | `foreground` `#1c1a17`, `subtle-foreground` `#57524a`, `muted-foreground` `#6b665d` | Principal, rótulo e valor secundário, apoio |
| Ação | `primary` `#143a2d`, `secondary` `#2f5f4d`, `ring` `#143a2d` | Botão principal, barras de progresso, anel de foco |
| Borda | `border` `#e6e1d6`, `border-strong` `#ded8cc`, `divider` `#f0ece3`, `input` `#8f8a80` | Cartão, contorno de botão e chip, linha interna, campo de formulário (3:1) |
| Navegação | `nav` `#143a2d`, `nav-foreground` branco, `nav-muted` `#bdc8c4`, `nav-active` `#cfe7a5` | Barra verde, destino inativo, destino ativo e anel sobre a barra |
| Perigo | `danger`, `danger-soft`, `danger-surface`, `danger-border`, `danger-foreground`, `danger-strong`, `danger-body` | Vencido, bloqueado, erro de campo, alerta de falha |
| Atenção | `warning`, `warning-soft`, `warning-surface`, `warning-border`, `warning-foreground`, `warning-body` | Reconciliação, custo provisório, snapshot congelado |
| Sucesso | `success`, `success-soft`, `success-surface`, `success-border`, `success-foreground`, `success-body` | Entregue, quitada, conexão ok |
| Tipografia | `font-serif` Source Serif 4, `font-sans` Geist, `font-mono` JetBrains Mono; `text-2xs` 11 px, `text-md` 13 px | Títulos, interface, códigos (`OS-2026-PC-0031`) |
| Forma | `--radius` 10 px: `rounded-sm` 6, `rounded-md` 8, `rounded-lg` 10, `rounded-xl` 12 | Badge, botão e campo, menu, cartão |
| Largura | `md` 768 px, `xl` 1280 px | Celular abaixo de `md`, grupos da navegação a partir de `xl` |

As fontes vêm de `@fontsource-variable` e o service worker guarda só os arquivos `latin` normais, o bastante para o português.

## Componentes

| Componente | Quando usar |
|---|---|
| `Heading` (`size` `page`, `section`, `title`), `Text` (`tone`, `size`, `weight`, `inline`, `numeric`), `Eyebrow`, `Mono` | Todo texto de tela; nunca `h1` ou `p` com classes |
| `Button` (`default`, `outline`, `dashed`, `ghost`, `nav`, `destructive`, `link`; `sm`, `touch`, `icon`) | Toda ação que não navega |
| `ButtonLink` com `render={<Link />}` | Navegação com aparência de botão; mantém o papel de link e o `aria-current` do router |
| `Badge`, `CodeTag` | Estado curto (vencido, parcial, entregue) e código documental em destaque |
| `Alert` com `AlertTitle`, `AlertDescription`, `AlertActions` | Aviso persistente de perigo, atenção ou sucesso com ação |
| `Panel` com `PanelHeader`, `PanelTitle`, `PanelMeta`, `PanelContent` | Qualquer bloco de conteúdo em cartão |
| `DataList`, `DataListHeader`, `DataListHeaderCell`, `DataListRow`, `DataListCell` | Tabela no desktop que vira cartão abaixo de 768 px (RF-ENT-06) |
| `Field`, `FieldLabel` (`requirement`), `FieldHint`, `FieldError`, `Input` | Campo de formulário; o Base UI liga rótulo, dica e erro ao controle |
| `Fieldset`, `FieldsetLegend`, `ChoiceChips`, `ChoiceChip` | Escolha única entre poucas opções (estado da peça, meio de pagamento) |
| `Stat`, `Meter`, `StageTrack` (etapas com `id` e `label`), `Checklist` | Métrica, capacidade com excesso marcado por cor e entalhe, etapa de produção, passos do wizard |
| `TopNav`, `TopNavSearch`, `TopNavAvatar`, `SubTabs`, `SyncStatus` | Barra do desktop, abas da seção e estado do sync |
| `MobileHeader` (`heading`, `headingAs`), `MobileHeaderBack`, `MobileNav` | Cabeçalho e barra inferior abaixo de 768 px; o título só vira `h1` com `headingAs="h1"`, quando a tela não tem `Heading` próprio |
| `NavMenu`, `DropdownMenu*`, `Skeleton`, `Toaster` | Menus, carregamento e avisos breves |

## Navegação

Os 13 destinos da RF-ENT-05 moram em `apps/web/src/lib/destinations.ts`, e a regra de onde cada um aparece é a função pura `navigationLayout` de `packages/ui/src/lib/navigation.ts`.

| Largura | Barra | Menus |
|---|---|---|
| 1280 px ou mais | Hoje, Agenda, Atendimento, Orçamentos, OS, Produção, Vendas | "Catálogo e estoque" (Catálogo, Estoque, Compras) e "Gestão" (Finanças, Relatórios, Configurações) |
| 768 a 1279 px | Hoje, Agenda, Atendimento, Orçamentos, OS, Vendas | "Mais" com Produção e os dois grupos com título |
| Abaixo de 768 px | Barra inferior com Hoje, Agenda, OS, Vendas | "Mais" com os soltos restantes e os dois grupos com título |

Os componentes de navegação recebem `renderLink` e não dependem do TanStack Router; o shell ligado às rotas chega com as telas da F2.

## Antes de criar uma tela

1. Abra a tela correspondente no projeto do Claude Design e o `/catalogo` com `pnpm dev:web`.
2. Monte só com componentes do `packages/ui`; componente que falta nasce lá, com os estados no catálogo.
3. Layout (`div`, `main`, `section`, `nav`) usa utilitários de espaçamento e grade; cor, tamanho de texto e raio vêm dos tokens.
4. Rode `pnpm --filter web test` e `pnpm --filter @costura-pro/ui test`, e valide com browser-harness em 320, 390, 768 e 1440 px, por toque e teclado.

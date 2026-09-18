# Serviços: custo, preço praticado e preço sugerido

**Files:** `packages/domain/src/service.ts`, `packages/domain/src/pricing.ts`, `packages/db/src/schema/services.ts`, `packages/db/src/schema/installation.ts`, `packages/db/src/migrations/0012_services_target_margin.sql`, `packages/api/src/services/schemas.ts`, `packages/api/src/services/store.ts`, `packages/api/src/services/commands.ts`, `packages/api/src/services/queries.ts`, `packages/api/src/services/router.ts`, `packages/api/src/installation/store.ts`, `packages/api/src/search.ts`, `apps/web/src/lib/services.ts`, `apps/web/src/services/`, `apps/web/src/routes/_app/catalogo-produtos/servicos/`, `packages/db/tests/services-schema.test.ts`, `apps/server/tests/services.test.ts`, `apps/server/tests/services-sync.test.ts`, `apps/web/tests/services.test.ts`

## Overview

O serviço é uma atividade de costura, própria ou terceirizada, com custo e preço praticado separados ([CONTEXT](../../CONTEXT.md), DEC-14). O custo não inclui materiais: eles entram à parte no orçamento e na ficha técnica. O dono vê em cada serviço o preço sugerido pela margem sobre a venda, a margem do preço que pratica e os avisos de abaixo da meta e abaixo do custo; a sugestão nunca muda o preço sozinha ([ADR 0020](../adr/0020-servico-versionado-e-preco-sugerido-na-leitura.md)).

O serviço é um agregado comum, no molde de [agregados](agregados.md), sem dado pessoal. A meta de margem do ateliê mora na instalação, e cada serviço pode ter a sua. O insumo não controlado não é cadastro: nasce como linha livre do orçamento na F4.

## Agregado e meta

| Onde | Campos |
|---|---|
| `service` | `name` (1 a 120), `category` (texto de 1 a 40 com sugestões, como a do material), `outsourced` (terceirizado, editável), `cost_cents` e `price_cents` (obrigatórios, maiores ou iguais a zero), `target_margin_basis_points` (nulo usa a do ateliê), `estimated_minutes` (1 a 9999, só para a agenda), `notes`, `search_text`, `archived_at`, `version` |
| `installation.target_margin_basis_points` | meta do ateliê em pontos-base, de 0 a 9999, padrão 4000 |

A versão do serviço é a do agregado: sobe a cada edição, inclusive arquivar e desarquivar, e a tela de edição a mostra ("Versão 3"). O orçamento da F4 copia nome, custo, preço e versão na linha.

## A conta do preço

`pricingOf` (`packages/domain/src/pricing.ts`) é a única conta, chamada pela lista e pela prévia do formulário por `servicePricingView` e `formPricing` (`apps/web/src/lib/services.ts`). O servidor não calcula sugestão.

| Valor | Conta |
|---|---|
| Meta usada | a própria do serviço ou, sem ela, a do ateliê |
| Preço sugerido | `suggestPrice(custo, meta)`: custo ÷ (1 − meta), arredondado para cima ao centavo |
| Abaixo da meta | preço praticado menor que o sugerido (igual não é abaixo) |
| Abaixo do custo | preço praticado menor que o custo |
| Margem do preço | (preço − custo) ÷ preço, em pontos-base, arredondada para baixo; sem margem com preço zero |

Exemplos: custo R$ 60 com meta de 40% sugere R$ 100; R$ 99,99 fica abaixo da meta com margem de 39,99%; custo R$ 60 e preço R$ 50 ficam abaixo do custo com margem de −20%.

A meta é digitada e exibida como percentual com até duas casas (`parseMarginPercent`, `formatMarginPercent`): "37,5" vira 3750.

## Comandos

| Comando | Agregado | Efeito |
|---|---|---|
| `service.create`, `.update`, `.archive`, `.unarchive` | `service` | como o material, com patch que aceita `null` para limpar categoria, meta própria, duração e notas |
| `installation.setTargetMargin` | `installation` | grava a meta do ateliê; a mesma meta devolve a versão atual sem escrever; id que não é o da instalação vira `aggregateNotFound` no push |

As procedures diretas são `services.*` e `pricing.settings` e `pricing.setTargetMargin`, que lê o id da instalação no servidor. A versão da instalação é compartilhada com o nome do ateliê.

## Telas

Catálogo tem a sub-aba Serviços (`/catalogo-produtos/servicos`), entre Materiais e Modelos de medidas. A lista mostra no topo a meta do ateliê com "Alterar meta" (diálogo), busca por nome e categoria, filtro de categoria e ativos ou arquivados, e por serviço o custo, o preço, a margem, o sugerido (com a meta própria quando houver) e os selos terceirizado, abaixo da meta e abaixo do custo. O formulário (novo e edição) tem "Quem faz" (no ateliê ou terceirizado, que troca o rótulo do custo para "Custo estimado"), custo, preço praticado, meta própria, o painel de preço sugerido com "Usar preço sugerido", que só preenche o campo, duração e notas. A edição congela a versão aberta, oferece "Carregar versão atual" num conflito e desativa arquivar enquanto houver mudança não salva.

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| Preço do serviço muda sozinho depois de mexer na meta | Sugestão gravada no serviço ou comando da meta que reescreve serviços | A sugestão só existe na leitura; o teste confere que a meta nova não muda preço, versão nem `change_log` do serviço |
| Sugestão da lista diferente da do formulário | Conta refeita na tela | As duas chamam `pricingOf` pelo mesmo caminho (`servicePricingView`) |
| "Margem 40%" ao lado de "abaixo da meta" (custo R$ 600, preço R$ 999,99) | Margem arredondada meio para cima chega à meta que o preço não alcança | Margem arredondada para baixo em `marginOfPrice`, com o caso no teste do domínio |
| Pull de um banco migrado traz a instalação sem `targetMarginBasisPoints` | O snapshot da instalação foi gravado antes da coluna existir, e a migration não grava snapshot novo | O consumidor aplica `defaultTargetMarginBasisPoints` até a próxima escrita da instalação ([SPEC §4](../SPEC.md#4-api-sincronização-e-conflito)) |
| Meta do ateliê recusada como versão desatualizada logo depois de renomear o ateliê | A meta e o nome do ateliê dividem a versão da instalação | Esperado ([ADR 0020](../adr/0020-servico-versionado-e-preco-sugerido-na-leitura.md)); o diálogo fecha com aviso e recarrega a versão |

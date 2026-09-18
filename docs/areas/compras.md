# Compras: fornecedor, conversão, rateio, obrigação e estorno

**Files:** `packages/domain/src/purchase.ts`, `packages/domain/src/supplier.ts`, `packages/db/src/schema/purchases.ts`, `packages/db/src/migrations/0010_suppliers_purchases_finance.sql`, `packages/db/src/migrations/0011_purchase_finance_append_only.sql`, `packages/api/src/purchases/store.ts`, `packages/api/src/purchases/supplier-store.ts`, `packages/api/src/purchases/schemas.ts`, `packages/api/src/purchases/commands.ts`, `packages/api/src/purchases/queries.ts`, `packages/api/src/purchases/router.ts`, `packages/api/src/materials/queries.ts`, `apps/web/src/lib/purchases.ts`, `apps/web/src/purchases/`, `apps/web/src/routes/_app/compras/`, `packages/db/tests/purchases-finance-schema.test.ts`, `apps/server/tests/purchases.test.ts`, `apps/server/tests/purchases-sync.test.ts`, `apps/server/tests/suppliers.test.ts`, `apps/web/tests/purchases.test.ts`

## Overview

A compra registra o que chegou de um fornecedor: cada item diz a variante, o local (e o lote, quando a variante controla lote), a embalagem, quantas embalagens e o preço de cada uma ([CONTEXT](../../CONTEXT.md)). O servidor converte a embalagem para a unidade base, rateia frete e desconto no custo de aquisição de cada item e grava, numa operação só, a compra, um movimento de estoque de entrada por item e a obrigação de pagar. A compra paga na hora grava também o pagamento, e a obrigação já nasce quitada.

Compra, obrigação e estorno da compra são fatos imutáveis, e o estado sai deles ([ADR 0019](../adr/0019-compra-e-obrigacao-como-fatos-imutaveis.md)). O fornecedor é um agregado comum, no molde de [agregados](agregados.md). As contas e o pagamento estão em [finanças](financas.md).

## Agregados

| Tabela | Papel | Campos próprios |
|---|---|---|
| `supplier` | agregado comum | `name` (1 a 120), `phone` e `email` (regras do cliente), `notes`, `search_text`, `archived_at` |
| `purchase` | append-only, só criação | `supplier_id`, `occurred_on`, `reference` (até 60), `notes`, `freight_cents`, `discount_cents`, `gross_cents`, `total_cents`, `items` em JSON |
| `obligation` | append-only, uma por compra | `kind` (`purchase`), `purchase_id` único, `amount_cents`, `due_on` |
| `purchase_reversal` | append-only, um por compra | `purchase_id` único, `occurred_on`, `reason` |

Cada item do JSON guarda o que foi digitado (`packagingLabel`, `packagingQuantityMicros`, `packageCountMicros`, `unitPriceCents`, local, lote, variante e o `movementId` do movimento que gerou) e o que foi calculado (`grossCents`, `freightCents`, `discountCents`, `quantityMicros`, `valueCents`). O movimento de estoque carrega `purchase_id`, então o histórico da variante leva de volta à compra.

## Conversão e rateio

`purchaseTotals` (`packages/domain/src/purchase.ts`) é a única conta, usada pelo servidor e pela prévia da tela:

| Valor | Conta |
|---|---|
| Total da linha | embalagens × preço por embalagem, meio para cima ao centavo |
| Quantidade na unidade base | embalagens × conteúdo da embalagem, meio para cima ao milionésimo |
| Frete e desconto de cada item | proporcional ao total da linha, arredondado para baixo; o último item com total de linha maior que zero recebe o que sobra, e o brinde (preço zero) não recebe nada |
| Custo de aquisição do item | total da linha + frete − desconto |
| Total da compra | soma das linhas + frete − desconto, igual à soma dos custos |

O piso nos itens com resto no último item com valor garante frete nunca negativo e brinde sem custo em qualquer posição da lista; o desconto no último item pode passar do valor dele só em compra degenerada (quatro itens de 1 centavo com 3 centavos de desconto), e isso é recusado como `negativeLine`. Também são recusados: quantidade que arredonda para zero, frete ou desconto sem nenhum item com preço, total zero ou negativo, e qualquer valor acima de 2^53 − 1. Na tela cada problema tem mensagem própria (`purchaseProblemMessage`).

A embalagem padrão vem da variante e pode ser trocada só naquela compra ([DEC-94](../PRD.md#93-catálogo-estoque-e-produção)); variante sem embalagem compra na própria unidade base, com conteúdo 1.

## Comandos

| Comando | Agregado criado | O que grava |
|---|---|---|
| `purchase.create` | `purchase` | a compra, um movimento `purchase` por item, a obrigação e, com pagamento na hora, o `obligationPayment` na conta |
| `purchase.reverse` | `purchaseReversal` | o estorno, um `reversal` de estoque por item pelo valor de entrada, e o estorno do pagamento ativo, se houver |
| `supplier.create`, `.update`, `.archive`, `.unarchive` | `supplier` | como o local de estoque |

O payload traz todo id que vai nascer: `movementId` de cada item, `obligationId` e, com pagamento na hora, o `movementId` do pagamento; o estorno traz um id por item (na ordem dos itens) e o `paymentReversalId`, que fica sem uso quando não há pagamento ativo. O `create` confere cada id antes de inserir e responde `aggregateExists`.

## Telas

Compras tem as sub-abas Compras (`/compras/recebidas`) e Fornecedores. Os seletores de fornecedor leem `suppliers.options`, que traz todos os fornecedores sem paginação: a nova compra oferece os ativos, mais o escolhido se tiver sido arquivado, e o filtro da lista oferece todos. A nova compra (`/compras/recebidas/nova`) inclui cada item num diálogo que busca a variante (`materialVariants.search`, que devolve a embalagem padrão), cria lote na hora quando a variante controla lote e mostra quanto entra na unidade base; a página resume o rateio por item e o custo por unidade base antes de salvar. O detalhe (`/compras/recebidas/$compraId`) mostra o custo de aquisição de cada item, o pagamento e "Estornar compra". Os ids da compra, da obrigação e do pagamento moram na página, então uma nova tentativa depois de falha repete o mesmo `opId`.

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| Tela da nova compra cai no erro de rota ao escolher a variante | `FieldHint` (parte do `Field` do Base UI) fora de um `Field` lança "FieldRootContext is missing" (erro 28 em produção) | Texto solto de apoio é `Text`, e `FieldHint` e `FieldError` só dentro de `Field` |
| Submit do diálogo de item registra a compra inteira | Diálogo com `<form>` próprio renderizado dentro do `<form>` da página: evento de portal sobe pela árvore do React, não pela do DOM ([React: createPortal](https://react.dev/reference/react-dom/createPortal), consultado em 2026-09-18) | Diálogos da página ficam fora do `<form>` |
| Nenhuma sub-aba marcada na nova compra e no detalhe | A aba ativa casa por prefixo, e as rotas filhas não ficavam abaixo do caminho da aba | Rotas filhas moram abaixo da coleção: `/compras/recebidas/nova` e `/compras/recebidas/$compraId` |
| `purchase.create` com `"12,50"` responde 500 | O `refine` do objeto roda mesmo com o campo reprovado por outro `refine` (falha continuável) e chama `BigInt` no texto cru | `whenShapeIsValid` (`packages/api/src/schemas.ts`) em todo `refine` de objeto que converte valor |
| Brinde no fim da lista faz a compra com desconto ser recusada | O resto do rateio caía no último item mesmo com peso zero, e o brinde ficava com custo negativo | O resto vai para o último item com total de linha maior que zero |
| Fornecedor além do 50º não aparece para escolher | O seletor lia uma página só de `suppliers.list` | `suppliers.options`, sem paginação |
| Estoque desfeito com a compra ainda ativa | Estorno avulso do movimento de compra pela tela de estoque | `stockMovement.reverse` recusa movimento com `purchase_id`; a tela mostra "Ver compra" no lugar de "Estornar" |

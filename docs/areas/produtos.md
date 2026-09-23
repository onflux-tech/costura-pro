# Produtos: produto base, variantes, galeria e ficha técnica

**Files:** `packages/domain/src/product.ts`, `packages/domain/src/quantity.ts`, `packages/db/src/schema/products.ts`, `packages/db/src/migrations/0013_products_variants.sql`, `packages/api/src/products/schemas.ts`, `packages/api/src/products/store.ts`, `packages/api/src/products/commands.ts`, `packages/api/src/products/queries.ts`, `packages/api/src/products/router.ts`, `packages/api/src/media/store.ts`, `apps/web/src/lib/products.ts`, `apps/web/src/lib/pricing.ts`, `apps/web/src/lib/photos.ts`, `apps/web/src/products/`, `apps/web/src/photos/`, `apps/web/src/pricing/`, `apps/web/src/materials/variant-picker.tsx`, `apps/web/src/routes/_app/catalogo-produtos/produtos/`, `packages/db/tests/products-schema.test.ts`, `apps/server/tests/products.test.ts`, `apps/server/tests/products-sync.test.ts`, `apps/server/tests/media-collect.test.ts`, `apps/web/tests/products.test.ts`

## Overview

O produto base representa uma roupa, um kit ou outro acabado; a variante é o que se vende, com código, preço praticado e, na F5, saldo próprio ([CONTEXT](../../CONTEXT.md)). O produto guarda a galeria compartilhada e a ficha técnica, que lista variantes de material com quantidade e perda normal, e serviços; a variante troca, tira ou acrescenta itens dessa ficha e escolhe a capa entre as fotos da galeria ([ADR 0021](../adr/0021-ficha-tecnica-no-produto-base-e-ajustes-por-variante.md)).

Os dois são agregados comuns, no molde de [agregados](agregados.md), sem dado pessoal. O custo estimado, o preço sugerido, a margem e os avisos são calculados na tela, como os do [serviço](servicos.md); o servidor guarda só a ficha, os ajustes e o preço praticado. Kit é produto com a categoria "Kit", sem comportamento próprio.

## Agregados

| Onde | Campos |
|---|---|
| `product` | `name` (1 a 120), `category` (texto de 1 a 40 com sugestões), `notes`, `photos` (0 a 12 `{ photoHash, thumbnailHash, caption }`, a primeira é a imagem principal), `sheet` (0 a 60 itens), `target_margin_basis_points` (nulo usa a do ateliê), `search_text`, `archived_at`, `version` |
| `product_variant` | `product_id`, `name` (1 a 80), `code` (livre, com aviso de repetido), `price_cents` (obrigatório, maior ou igual a zero), `cover_photo_hash` (ponteiro para uma foto da galeria), `sheet_changes` (0 a 60 ajustes), `search_text`, `archived_at`, `version` |

Quantidades dentro do JSON da ficha viajam como string de dígitos; `price_cents` usa `bigintInteger`. As variantes listam em ordem de criação (`created_at` e `id`), para P, M e G não virarem G, M e P.

## Ficha técnica

| Peça | Forma |
|---|---|
| Item de material | `{ id, kind: "material", materialVariantId, quantityMicros, loss, note }`, com `loss` nulo, `{ kind: "fixed", quantityMicros }` ou `{ kind: "percent", basisPoints }` (1 a 9999) |
| Item de serviço | `{ id, kind: "service", serviceId, count, note }`, com `count` de 1 a 99 |
| Ajuste da variante | `{ kind: "replace", item }` (o item leva o id do item da base), `{ kind: "remove", itemId }` ou `{ kind: "add", item }`; no máximo um por item da base |

O id de cada item nasce no aparelho e não muda entre edições; é por ele que o ajuste da variante acha o item da base. A mesma variante de material pode aparecer duas vezes, com observações diferentes ("Tecido principal", "Forro").

## A conta do custo

Uma função do domínio para cada passo, chamadas pela tela por `baseEstimate`, `variantEstimate` e `variantPricing` (`apps/web/src/lib/products.ts`):

| Passo | Regra |
|---|---|
| Ficha efetiva (`effectiveSheet`) | base na ordem, trocas no lugar, tirados fora, acrescentados no fim; ajuste de item que saiu da base é ignorado |
| Quantidade planejada (`plannedQuantity`) | quantidade + perda fixa, ou quantidade + teto(quantidade × pontos-base ÷ 10000) |
| Custo da linha (`sheetCost`) | material: planejada × custo de referência (`multiplyHalfUp`, meio para cima ao centavo); serviço: quantidade × custo atual |
| Custo estimado | soma das linhas, com `status` `complete`, `incomplete` (material sem custo de referência ou referência desconhecida) ou `empty` (ficha efetiva vazia, que não tem custo) |
| Preço | `variantPricing` recebe o produto, para a meta própria, e chama `pricingPreview` com ela ou com a do ateliê; fora de `complete` devolve `null`, sem sugestão, margem nem aviso |

Exemplo da verificação: Oxford Azul 1,20 m com 10% (R$ 33,66), linha 50 m com perda fixa de 5 m (R$ 1,10), zíper (R$ 3,50), costura (R$ 40,00) e bordado × 2 (R$ 30,00) somam R$ 108,26 e sugerem R$ 180,44 com 40%.

As referências que a conta usa vêm de `products.get` (`references`): toda variante de material e todo serviço citados na base e nos ajustes, com nome, unidade, precisão e custo, e `archived` quando a variante, o material ou o serviço está arquivado.

## Comandos

| Comando | Agregado | Efeito |
|---|---|---|
| `product.create`, `.update`, `.archive`, `.unarchive` | `product` | patch troca `photos` e `sheet` inteiras e aceita `null` para limpar categoria, meta própria e notas |
| `productVariant.create`, `.update`, `.archive`, `.unarchive` | `productVariant` | a criação recusa produto inexistente (`aggregateNotFound`); patch com nome, código, preço, capa e ajustes, `null` limpa código e capa |

O servidor confere só a forma das referências da ficha: ids UUID únicos, faixas e no máximo um ajuste por item. Material e serviço nunca são apagados, então id desconhecido só aparece por erro de cliente, e a tela o mostra como "Material não encontrado" sem custo.

## Galeria e capa

As fotos seguem a [mídia](midia.md) de sempre, com o campo de fotos e o visualizador comuns de `apps/web/src/photos/`. `referencedHashes` inclui as fotos de `product.photos` e dos conflitos abertos de `product`. A capa é só o hash de uma foto da galeria: resolve na leitura (`coverOf`, `displayPhotoOf`), não prende arquivo e some junto com a foto, e a variante volta à imagem principal.

## Telas

Produtos é a primeira aba do Catálogo, e `/catalogo-produtos` abre nela. A lista tem busca por produto, variante e código, filtro de categoria e ativos ou arquivados, com a imagem principal, o número de variantes ativas e a faixa de preço. A página do produto mostra a galeria, a ficha com o custo da base e o que falta, e as variantes com capa, custo, preço, margem e selos. A ficha se edita numa página própria (`/ficha`), com um diálogo para cada item; a variante tem formulário com capa escolhida da galeria, painel de preço sugerido e a seção "Ficha desta variante" com Trocar, Tirar, Desfazer troca, Devolver e Acrescentar. Com 60 ajustes vivos (`changesFull`), Trocar e Tirar dos itens da base e os dois Acrescentar ficam desativados, com aviso; editar e desfazer continuam. Ficha vazia aparece como "Ficha vazia" no custo, na seção e na lista, sem sugestão nem margem. Todas as edições congelam a versão aberta e oferecem "Carregar versão atual" no conflito, e as rotas delas recebem `key` pelo parâmetro para remontar quando o produto ou a variante da URL muda.

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| Custo da tela diferente do exemplo por um centavo | Conta refeita no componente | Toda linha passa por `sheetCost`, e a tela só formata |
| Ajuste da variante some ou quebra a validação depois que a base muda | Ajuste de item que saiu da base | A ficha efetiva ignora o órfão, e `liveChanges` o descarta no próximo salvamento da variante |
| Capa mostra foto que o dono tirou da galeria | Capa gravada como foto própria | A capa é ponteiro para a galeria e resolve na leitura |
| Foto da galeria some depois de 24 h | Agregado novo fora de `referencedHashes` | Fotos de `product` e dos dois lados dos conflitos abertos de `product` no conjunto, com teste de coleta para cada lado |
| Produto recém-criado sugere R$ 0,00 com margem de 100% | Soma da ficha vazia tratada como custo completo | `status` `empty` na estimativa, e `variantPricing` só sugere com `complete` |
| Variante com mais de 60 ajustes volta com "Confira os campos e tente de novo." | Teto conferido só no Acrescentar, mas Trocar e Tirar também criam ajuste | `changesFull` conta os ajustes vivos e desativa toda ação que cria ajuste |
| Nova variante mostra um produto e grava em outro depois de voltar pelo histórico | A rota não remonta quando só o parâmetro muda, e a página misturava o produto congelado com o `productId` da URL | `key` pelo parâmetro nas rotas de produto, no molde de `apps/web/src/routes/_app/catalogo-produtos/servicos/$servicoId.tsx` |
| Linha repetida na ficha efetiva | Ajuste `add` com o id de um item da base: o servidor confere só a forma, e a edição da variante não lê o produto | A web sempre gera id novo para o item acrescentado; outro cliente que escreva ajustes precisa fazer o mesmo |

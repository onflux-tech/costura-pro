# Catálogo de materiais

**Files:** `packages/domain/src/unit.ts`, `packages/domain/src/quantity.ts`, `packages/domain/src/money.ts`, `packages/domain/src/material.ts`, `packages/db/src/columns.ts`, `packages/db/src/schema/materials.ts`, `packages/db/src/migrations/0007_materials_variants.sql`, `packages/api/src/materials/`, `packages/api/src/schemas.ts`, `apps/web/src/lib/materials.ts`, `apps/web/src/materials/`, `packages/ui/src/components/number-field.tsx`, `packages/ui/src/components/select.tsx`, `packages/ui/src/components/suggestion-field.tsx`, `packages/db/tests/materials-schema.test.ts`, `apps/server/tests/materials.test.ts`, `apps/server/tests/materials-sync.test.ts`, `apps/web/tests/materials.test.ts`

## Overview

O material base agrupa variantes, que são o que tem código, unidade, custo e, no futuro, saldo ([CONTEXT](../../CONTEXT.md)). Os dois são agregados no padrão de [agregados](agregados.md), com comando definido uma vez e exposto pela procedure direta e pelo `sync.push`. Esta é a primeira área com dinheiro e quantidade, então é ela que fixa como valor inteiro atravessa domínio, banco, API e tela ([ADR 0010](../adr/0010-dinheiro-e-quantidade-inteiros.md), [ADR 0017](../adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md)).

## Valor inteiro em cada camada

| Camada | Forma | Onde |
|---|---|---|
| Domínio | `bigint` de centavos e de milionésimos, com `parseQuantity`, `formatQuantity`, `parseMoney` e `formatMoney` | `packages/domain/src/quantity.ts`, `money.ts` |
| Banco | Coluna `integer` por `bigintInteger`, que devolve `bigint` e recusa acima de 2^53 - 1 | `packages/db/src/columns.ts` |
| Payload e snapshot | String de dígitos canonicalizada (`"1250"`, `"1500000"`), nunca `bigint` | `packages/api/src/schemas.ts`, `packages/api/src/materials/store.ts` |
| Tela | String do formulário, convertida por `BigInt(...)` só para formatar | `apps/web/src/lib/materials.ts` |

`formatQuantity` nunca arredonda: mostra as casas que o valor gravado tiver, no mínimo a precisão exibida. A precisão é só exibição, então nem o servidor nem o formulário a usam para validar: o formulário aceita até 6 casas (o máximo), senão baixar a precisão travaria a edição de uma variante com valor já gravado.

## Unidade base

A lista fechada vive em `packages/domain/src/unit.ts` (metro, centímetro, metro quadrado, unidade, par, grama, quilograma, mililitro, litro), cada uma com abreviação e precisão sugerida. O banco repete os códigos em `baseUnitValues` (`packages/db/src/schema/materials.ts`), como o repositório já faz com o estado da peça recebida, e `apps/server/tests/materials.test.ts` compara as duas listas para elas não divergirem. A unidade é imutável depois da criação: o patch não a aceita, e a tela de edição mostra a unidade como texto.

## Agregados

| Agregado | Campos próprios |
|---|---|
| `material` | `name`, `category` (texto de 1 a 40 com sugestões, resolve a Q-02 sem agregado), `notes`, `search_text` |
| `material_variant` | `material_id`, `name`, `code` (livre, sem unicidade), `base_unit`, `display_precision`, `reference_cost_cents`, `min_quantity_micros`, `target_quantity_micros`, `packaging_label` e `packaging_quantity_micros` (par completo ou os dois nulos), `tracks_lots` (controle por lote, imutável), `photo` (hash e miniatura), `search_text` |

Nenhum dos dois tem dado pessoal, então ficam fora de `personalDataAggregates` e o `anonymized` dos comandos é sempre `false`.

A busca da lista casa cada token contra o `search_text` do material ou o de alguma variante dele, por subconsulta tipada (`inArray`), e `variantCount` conta variantes ativas em SQL literal com colunas qualificadas.

## Foto da variante

Uma foto por variante, pela mesma infraestrutura de [mídia](midia.md): a tela envia os bytes antes do comando e o agregado guarda `{ photoHash, thumbnailHash }`. Os quatro caminhos JSON da variante (linha viva e conflitos abertos, nos valores locais e atuais) entram em `referencedHashes` de `packages/api/src/media/store.ts`.

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| `sync.push` derruba a requisição num conflito de edição | O `sync_conflict` grava o payload já parseado, e `JSON.stringify` de `bigint` lança | Schema de payload devolve string; só o store converte para `bigint` |
| Valor gravado diferente do digitado | Formatar ou validar arredondando pela precisão exibida | `formatQuantity` mostra as casas reais e o formulário valida contra o máximo de 6 casas |
| Foto some ao editar a variante | Hook da foto inicializado antes da consulta resolver, com `useState` que não reinicializa | A tela de edição só monta o editor com o registro carregado, com `key` na versão |
| Coleta apaga a foto da variante | Agregado novo fora de `referencedHashes` | Os quatro caminhos JSON no conjunto, com teste de coleta |
| Unidade da variante muda e reinterpreta o histórico | Patch que aceita `baseUnit` | O schema de patch não tem o campo; um payload com ele vira `invalidPayload` no push |
| Controle por lote muda e parte o saldo da variante | Patch que aceita `tracks_lots` | Mesmo desenho da unidade base: fora do patch, conferido no push ([estoque](estoque.md)) |
| Um pedido por tecla no aviso de código repetido | Consulta ligada direto ao valor do campo | `useRepeatedCode` espera 400 ms antes de consultar |
| Foto gravada some depois de uma falha de envio | O hook zerava a foto confirmada ao escolher a nova, e o salvamento seguia liberado com `photo: null` | Guardar a última confirmada, bloquear o salvamento enquanto houver foto pendente ou falhada e oferecer "Descartar a foto nova" |
| Formulário perde o preenchimento ao arquivar | Arquivar troca a versão e remonta o editor | Arquivar desativado enquanto houver mudança não salva |
| Filtro "Todas as categorias" para de filtrar | Sentinela de texto no mesmo espaço de nomes da categoria digitada | Valores `*`, `-` e prefixo `c:` no seletor, com `categoria` e `semCategoria` separados na URL |

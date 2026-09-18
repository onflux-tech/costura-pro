# Estoque: local, lote, movimento e saldo

**Files:** `packages/domain/src/stock.ts`, `packages/db/src/schema/stock.ts`, `packages/db/src/migrations/0008_stock_locations_lots_movements.sql`, `packages/db/src/migrations/0009_stock_movement_append_only.sql`, `packages/api/src/stock/store.ts`, `packages/api/src/stock/schemas.ts`, `packages/api/src/stock/commands.ts`, `packages/api/src/stock/queries.ts`, `packages/api/src/stock/router.ts`, `packages/api/src/schemas.ts`, `apps/web/src/lib/stock.ts`, `apps/web/src/stock/`, `apps/web/src/routes/_app/estoque/`, `packages/db/tests/stock-schema.test.ts`, `apps/server/tests/stock.test.ts`, `apps/server/tests/stock-sync.test.ts`, `apps/web/tests/stock.test.ts`

## Overview

O saldo físico é controlado por variante de material, local de estoque e, quando a variante controla lote, também por lote ([CONTEXT](../../CONTEXT.md)). Três agregados novos seguem o padrão de [agregados](agregados.md): `stockLocation` e `stockLot` são comuns (criação e edição com compare-and-set), e `stockMovement` é o primeiro agregado append-only do sistema, que só tem criação ([ADR 0018](../adr/0018-movimento-append-only-com-projecao-de-saldo.md)). O saldo é a projeção `stock_balance`, escrita na mesma transação do movimento e recalculável a partir dele.

Esta é a segunda área com dinheiro e quantidade e a primeira com valores **negativos**, o que fixou o sinal na travessia inteira ([ADR 0017](../adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md)).

## Agregados e projeção

| Tabela | Papel | Campos próprios |
|---|---|---|
| `stock_location` | agregado comum | `name` (1 a 60), `notes`, `archived_at` |
| `stock_lot` | agregado comum, filho da variante | `variant_id`, `label` (1 a 60), `notes`, `archived_at` |
| `stock_movement` | agregado append-only, só criação | `variant_id`, `location_id`, `lot_id`, `kind`, `quantity_micros` e `value_cents` assinados, `occurred_on`, `reason`, `transfer_id`, `reverses_movement_id`; sem `updated_at` e sem `archived_at` |
| `stock_balance` | projeção, não é agregado | `id` derivado por `balancePointId`, `variant_id`, `location_id`, `lot_id`, `quantity_micros`, `value_cents` |

O `id` da projeção é `variantId|locationId|lotId ou -`, porque coluna anulável dentro de chave primária não garante unicidade no SQLite: dois pontos sem lote seriam duas linhas.

## Tipos de movimento

| `kind` | Nasce por | Sinal |
|---|---|---|
| `opening` | `stockMovements.create` | positivo, com valor informado |
| `adjustment` | `stockMovements.create` | positivo com valor informado, ou negativo pela média do ponto |
| `transferOut` e `transferIn` | `stockMovements.transfer`, duas linhas com o mesmo `transfer_id` | negativo na origem, positivo no destino |
| `reversal` | `stockMovements.reverse` | contrário ao movimento original |

`stockMovements.create` só aceita `opening` e `adjustment`: a união discriminada recusa os outros pela forma, então um payload com `transferOut` vira `invalidPayload` no push em vez de criar meia transferência.

## Valor de uma saída

O valor sai da média do ponto de saldo, `exitValueCents(quantidade, valor, saída)` em `packages/domain/src/stock.ts`, arredondado ao centavo meio para cima, e é congelado no próprio movimento. Ponto zerado ou negativo devolve `0n` sem dividir por zero. Numa variante com lote, o ponto já é o lote, então a mesma conta serve com e sem lote.

Como o movimento carrega o valor decidido, a projeção é soma pura: a ordem em que os movimentos chegam não muda o saldo.

## Lote opcional por variante

A variante declara `tracks_lots` na criação, e o campo é imutável como a unidade base: o patch não o aceita, então a regra vive na forma do payload e não precisa de caminho de rejeição dentro de `updateCommands`. `checkPlace` (`packages/api/src/stock/commands.ts`) recusa movimento sem lote em variante que controla lote, movimento com lote em variante que não controla, e lote de outra variante, sempre como `aggregateNotFound`.

## Correção é estorno

`stockMovements.reverse` grava o movimento contrário apontando para o original. Um índice único em `reverses_movement_id` garante um estorno por movimento no banco (em SQLite os nulos não colidem), além da checagem na criação, que devolve `aggregateExists`. Para isso, `CreateRejection` ganhou a razão `aggregateExists`, que o push já conhecia como quarentena e que a procedure direta traduz em `CONFLICT`.

Estornar uma perna de transferência estorna a contraparte na mesma operação, com `counterpartId` no payload; sem isso a quantidade total mudaria, porque só um dos dois locais seria desfeito.

## Telas

Estoque tem as sub-abas Saldos e Locais, e `/estoque` redireciona para Saldos (sem o redirect, o destino do menu cai no estado vazio do `$destino`). A lista de saldos traz **uma linha por variante ativa**, inclusive as que ainda não têm movimento, porque é dela que sai o lançamento do saldo de abertura; com filtro de local, só aparecem as que têm saldo naquele local. Abrir a linha revela os pontos e o histórico, limitado às últimas 200 linhas.

O menu de ações da linha abre abertura, ajuste e transferência em diálogo, e **Lotes** nas variantes que controlam lote: é por ali que o lote nasce, e sem essa tela a variante por lote não recebe movimento nenhum. A data de todo lançamento vem de `localDay`, o mesmo fuso do resto do app, e o estorno guarda os ids sorteados por movimento alvo, para que uma nova tentativa depois de falha repita o mesmo `opId` com o mesmo conteúdo. A ficha do material mostra o saldo de cada variante, só leitura, com link para Estoque.

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| A variante não aparece para receber o saldo de abertura | Lista de saldos partindo de `stock_balance`, que só tem linha depois do primeiro movimento | `LEFT JOIN` a partir de `material_variant`, com `having` só quando há filtro de local |
| Dinheiro negativo sai como `R$ -12,-50` | `formatMoney` e `formatQuantity` dividiam e tiravam o resto do valor com sinal, então a parte decimal também vinha negativa | Separar o sinal antes de formatar (`partsOf` e `decimalOf`); esta área é a primeira com valor negativo |
| Transferência estornada cria quantidade do nada | Estornar só a perna apontada deixa a contraparte viva, e o total sobe | `readTransferCounterpart` pelo `transfer_id` e as duas linhas estornadas na mesma operação |
| Saldo de uma variante com lote fica partido entre "com lote" e "sem lote" | Lote decidido por movimento em vez de por variante | `tracks_lots` imutável na variante, conferido em `checkPlace` |
| Duas linhas de saldo para o mesmo ponto sem lote | Chave primária composta com coluna anulável: no SQLite os nulos não colidem | `id` textual derivado por `balancePointId` |
| `ESCAPE expression must be a single character` na busca | O literal do `ESCAPE` ficou com dois caracteres depois de uma reescrita automática do arquivo | No template do Drizzle o escape é `'\\'`, que vale um caractere; conferir o SQL com `.toSQL()` |
| Projeção divergente da soma dos movimentos | Insert de movimento fora de `insertStockMovement` | Um único caminho de escrita, com teste que compara a soma por ponto com a projeção |
| Variante "por lote" fica sem conseguir receber saldo | O comando de lote existe e a tela não | Menu de ações com Lotes; comando novo sem tela é lacuna de produto, não só de código |
| Destino do menu abre "área ainda não disponível" com as abas por cima | Falta a rota de índice que redireciona para a primeira aba | `routes/_app/<destino>/index.tsx` com `redirect`, como em `catalogo-produtos` |
| Nova tentativa de estorno responde que o cadastro foi enviado com outros dados | Ids sorteados a cada clique sob uma chave de `opId` estável | Guardar os ids por movimento alvo, como o diálogo faz com `useState` |
| Data do movimento cai no dia seguinte à noite | `toISOString()` é UTC | `localDay` (`apps/web/src/lib/measurements.ts`), o mesmo do resto do app |
| Soma de saldo volta como número do JavaScript | `sum()` em `sql` cru não passa pelo tipo da coluna | `cast(... as text)` na consulta, e o valor segue como string até a tela |

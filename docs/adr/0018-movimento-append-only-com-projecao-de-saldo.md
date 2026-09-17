---
status: accepted
date: 2026-09-17
---

# Movimento de estoque append-only com projeção de saldo na mesma transação

A [ADR 0003](0003-movimentos-imutaveis-e-custo-provisorio.md) fixou que movimento de estoque nunca é editado nem apagado, sem dizer de onde sai o saldo. A partir desta entrega, o saldo mora numa projeção `stock_balance` com uma linha por ponto (variante, local e lote), escrita na mesma transação que insere o movimento, por um único caminho (`applyMovement` em `packages/api/src/stock/store.ts`). O movimento é o primeiro agregado do sistema que só tem criação: nasce com `version` 1, não tem comando de edição nem de arquivamento, e duas triggers recusam `UPDATE` e `DELETE` na tabela.

A projeção não é agregado: fica fora de `AggregateType` e do `change_log`, porque é inteiramente derivável dos movimentos, que são agregados e viajam no `sync.pull`.

## Opções consideradas

- **Somar os movimentos a cada leitura, sem projeção:** fonte única de verdade e impossível divergir, mas toda tela de saldo varre a tabela que mais cresce no sistema, e a F4 repete isso por item da lista de compras consolidada. Dá para viver disso com índice coberto hoje e dói quando a OS chegar; trocar depois é migration nova mais reescrita de todas as leituras.
- **Projeção só por (variante, local), com o lote somado sob demanda:** tabela menor, mas a sugestão do lote mais antigo com saldo (RF-EST-10) cai no caminho lento justo onde é usada peça a peça.
- **Projeção como agregado próprio, com `version` e comandos:** entraria no `change_log` e no pull, ao custo de um agregado que ninguém edita, cuja versão não significa nada e cujo conteúdo o dispositivo já consegue recalcular.
- **Movimento mutável com `version`, como os outros agregados:** reaproveitaria `updateCommands`, mas contraria a invariante de que correção é estorno, e a trigger append-only é justamente o que impede o erro silencioso.

## Consequências

- Leitura de saldo é O(1) por ponto, e `stockBalances.list` agrega por variante com `LEFT JOIN` a partir de `material_variant`, então variante ativa sem nenhum movimento aparece com saldo zero e pode receber o saldo de abertura.
- A projeção só pode divergir se alguém inserir movimento fora de `insertStockMovement`; `apps/server/tests/stock.test.ts` compara a soma dos movimentos por ponto com a projeção e falha na divergência.
- Quantidade e valor do movimento são assinados, então a projeção é soma pura e a ordem de chegada não muda o resultado.
- O valor de uma saída é resolvido na criação, pela média do ponto (`exitValueCents`), e congelado na linha: o movimento carrega o valor já decidido, e nenhuma releitura posterior o reinterpreta.
- Correção é estorno: um movimento `reversal` aponta para o original por `reverses_movement_id`, com índice único que garante um estorno por movimento no banco, além da checagem na criação. Estornar uma perna de transferência estorna a outra na mesma operação, senão a quantidade total mudaria.
- Transferência é uma operação que grava duas linhas ligadas por `transfer_id`, cada uma com um único local, para que todo movimento continue sendo uma variação de saldo num ponto só.
- O dispositivo que sincroniza recebe os movimentos pelo `change_log` e reconstrói a projeção localmente; ela nunca viaja.

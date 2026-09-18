# Finanças: contas, movimento financeiro e obrigação a pagar

**Files:** `packages/domain/src/finance.ts`, `packages/db/src/schema/finance.ts`, `packages/db/src/migrations/0010_suppliers_purchases_finance.sql`, `packages/db/src/migrations/0011_purchase_finance_append_only.sql`, `packages/api/src/finance/store.ts`, `packages/api/src/finance/schemas.ts`, `packages/api/src/finance/commands.ts`, `packages/api/src/finance/queries.ts`, `packages/api/src/finance/router.ts`, `packages/api/src/purchases/commands.ts`, `packages/api/src/purchases/queries.ts`, `apps/web/src/lib/finance.ts`, `apps/web/src/finance/`, `apps/web/src/routes/_app/financas/`, `apps/server/tests/finance.test.ts`, `apps/server/tests/finance-sync.test.ts`, `apps/web/tests/finance.test.ts`

## Overview

A conta financeira é onde o dinheiro do ateliê fica: caixa, banco, Pix ou outra ([CONTEXT](../../CONTEXT.md)). Cada variação de saldo é um movimento financeiro append-only, no mesmo molde do movimento de estoque ([ADR 0018](../adr/0018-movimento-append-only-com-projecao-de-saldo.md)): quantia assinada, estorno que referencia o original e transferência em duas pernas. Esta entrega traz o saldo de abertura, a transferência entre contas, o estorno e o pagamento de obrigação de compra ([compras](compras.md), [ADR 0019](../adr/0019-compra-e-obrigacao-como-fatos-imutaveis.md)).

## Agregados

| Tabela | Papel | Campos próprios |
|---|---|---|
| `financial_account` | agregado comum | `name` (1 a 60), `kind` (`cash`, `bank`, `pix`, `other`, editável), `notes`, `archived_at` |
| `financial_movement` | append-only, só criação | `account_id`, `kind`, `amount_cents` assinado, `occurred_on`, `reason`, `transfer_id`, `reverses_movement_id` (único), `obligation_id` |

O saldo da conta é a soma dos movimentos, calculada na leitura (`listFinancialAccounts`), sem projeção: são poucas contas e nada pode divergir. A soma volta como texto (`cast(... as text)`), como no estoque.

## Tipos de movimento

| `kind` | Nasce por | Sinal |
|---|---|---|
| `opening` | `financialMovement.create` | positivo ou negativo (cheque especial), nunca zero |
| `transferOut` e `transferIn` | `financialMovement.transfer`, duas linhas com o mesmo `transfer_id` | negativo na origem, positivo no destino |
| `obligationPayment` | `obligation.pay` ou compra paga na hora | negativo, pelo valor inteiro da obrigação |
| `reversal` | `financialMovement.reverse` ou estorno da compra | contrário ao original, com o `obligation_id` dele |

Um estorno não se estorna (`Estorno não se estorna`, `aggregateNotFound`): lança-se de novo o que for preciso. Estornar uma perna de transferência estorna as duas; estornar um pagamento reabre a obrigação.

## Obrigação a pagar

A obrigação nasce com a compra (ver [compras](compras.md)) e o estado sai dos fatos: cancelada se a compra foi estornada, paga se há pagamento sem estorno, aberta nos demais casos. `obligation.pay` confere nessa ordem: obrigação inexistente, compra estornada (`Obrigação cancelada`), pagamento ativo (`Obrigação já paga`, `aggregateExists`) e conta inexistente. Vencida é só a obrigação aberta com vencimento passado, e só a tela calcula isso.

## Telas

Finanças tem as sub-abas Contas e A pagar. Contas lista o saldo de cada conta (negativo em vermelho), com Saldo de abertura, Transferir, Editar e Arquivar no menu da linha, e o extrato abre na própria linha, com "Estornar" e "Ver compra" nos pagamentos. O extrato mostra os 200 movimentos mais recentes e avisa quando corta; o saldo soma todos. Os ids e o `opId` do saldo de abertura e da transferência ficam na página por conta e ação (`useDrafts` em `apps/web/src/lib/drafts.ts`), então fechar e reabrir o diálogo depois de uma resposta perdida repete a mesma operação em vez de lançar o dinheiro em dobro. A pagar lista as abertas por vencimento, com as vencidas marcadas, e filtra as pagas e as canceladas; "Pagar" escolhe a conta, com o saldo dela ao lado, e a data.

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| Segundo insert da operação derruba o push inteiro com 500 | `inboundId` (ou `counterpartId`) igual ao id da própria operação passava pela conferência de "já existe" e batia na chave primária | O `create` recusa segundo id igual ao `aggregateId` como `aggregateExists`, no estoque e nas finanças |
| Estado da obrigação errado depois de pagar, estornar e pagar de novo | Pagamento considerado ativo sem olhar o estorno | `readActiveObligationPayment` filtra `obligationPayment` sem estorno, em SQL literal com a tabela qualificada |
| Saldo de abertura em dobro depois de uma resposta perdida | O diálogo sorteava ids e `opId` ao montar, e reabrir mandava uma operação nova que o servidor não tem como recusar | Rascunho por conta e ação na página, descartado só no sucesso (`useDrafts`) |
| Rádios de pagamento e de saldo lidos como "Pagamento" e "Saldo" pelo leitor de tela | `ChoiceChips` dentro de `Field`: o Base UI liga cada `Radio` ao `FieldLabel` por `aria-labelledby` | Grupo de chips usa `Fieldset` com `FieldsetLegend`, como o formulário de cliente |

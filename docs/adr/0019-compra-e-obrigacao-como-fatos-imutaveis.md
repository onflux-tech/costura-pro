---
status: accepted
date: 2026-09-18
---

# Compra, obrigação e estorno como fatos imutáveis, com estado derivado

A compra recebida gera movimentos de estoque, que já são append-only ([ADR 0018](0018-movimento-append-only-com-projecao-de-saldo.md)), e uma obrigação de pagar o fornecedor. Esta entrega decide que a própria compra, a obrigação, o estorno da compra e o movimento financeiro também são fatos: cada um nasce com `version` 1, só tem criação, e triggers recusam `UPDATE` e `DELETE` nas quatro tabelas (`purchase`, `obligation`, `purchase_reversal` e `financial_movement`).

Nenhuma dessas linhas guarda estado. A situação de uma obrigação sai dos fatos, nesta ordem: **cancelada** quando existe o estorno da compra; **paga** quando existe um pagamento (`obligationPayment`) sem estorno; **aberta** nos demais casos (`obligationStatus` em `packages/domain/src/finance.ts`). A situação da compra é a da obrigação dela, com "estornada" no lugar de "cancelada".

Toda compra nasce com a sua obrigação, inclusive a paga na hora: nesse caso o pagamento é gravado na mesma operação, e a obrigação já nasce quitada. Assim o pagamento sempre aponta para uma obrigação, e a F5 junta as obrigações recorrentes na mesma tela "A pagar" sem outro caminho.

## Opções consideradas

- **Compra editável enquanto não paga, reescrevendo os movimentos:** mais confortável para quem digitou errado, mas cada edição vira estorno e relançamento automáticos, multiplica movimentos e abre conflito de versão no sync para um registro que o celular pode ter lançado offline.
- **Coluna de estado na obrigação (`open`, `paid`, `cancelled`), atualizada pelos comandos:** consulta mais simples, mas cria um segundo registro que precisa concordar com os pagamentos e estornos; dois aparelhos pagando a mesma obrigação offline viram conflito de versão em vez de recusa clara.
- **Prazo e vencimento em colunas da compra, sem obrigação:** uma tabela a menos agora, mas a F5 precisa de outra fonte para as obrigações recorrentes e a tela "A pagar" passa a juntar duas.
- **Estorno como edição da compra (`reversed_at`):** exigiria liberar `UPDATE` numa tabela de fatos ou um caminho de rejeição em `updateCommands`, que hoje não existe no push.

## Consequências

- Correção de compra é o estorno inteiro: um registro em `purchase_reversal`, com índice único por compra, estorna cada movimento de estoque pelo valor de entrada e o pagamento ativo, se houver. O estorno avulso de um movimento de compra pela tela de estoque é recusado, senão a compra ficaria "ativa" com estoque desfeito.
- Pagar é criar um movimento financeiro; estornar o pagamento reabre a obrigação. Pagar de novo uma obrigação já paga, ou uma obrigação de compra estornada, é recusado nos dois caminhos com as razões que já existiam (`aggregateExists` e `aggregateNotFound`), sem razão de quarentena nova.
- As consultas calculam o estado em SQL com os mesmos `EXISTS` que o domínio descreve, e o dispositivo que sincroniza chega ao mesmo resultado a partir dos fatos que recebe no pull.
- O saldo de uma conta financeira é a soma dos movimentos na leitura, sem projeção: são poucas contas, a consulta usa o índice por conta, e nada pode divergir. Uma projeção pode entrar depois sem mudar o contrato do sync.
- Os ids de toda linha criada (movimentos de cada item, obrigação, pagamento, estornos) nascem no aparelho e viajam no payload ([ADR 0009](0009-uuid-e-codigo-documental-por-dispositivo.md)), e o comando confere cada um antes de inserir.

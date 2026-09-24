---
status: accepted
date: 2026-09-24
---

# Aprovação como fato que cria a OS, com reserva e recebível como fatos

O RF-COM-05 pede que a aprovação crie, numa operação só, a OS com subitens, o snapshot de medidas, as reservas, as pendências e o recebível. O [ADR 0002](0002-os-op-e-venda-direta.md) separa OS, OP e venda direta, o [ADR 0023](0023-orcamento-rascunho-com-revisao-emitida-como-fato.md) congela o conteúdo emitido na revisão, e a compra já é um fato criado com vários ids do aparelho no payload ([ADR 0019](0019-compra-e-obrigacao-como-fatos-imutaveis.md)). Antes do schema era preciso decidir o que é agregado vivo e o que é fato, quem calcula a reserva e o que a anonimização faz com a OS.

**Agregados e fatos.** A aprovação (`quote_approval`), a reserva (`stock_reservation`) e o recebível (`receivable`) são fatos append-only: triggers recusam `UPDATE` e `DELETE`. A OS (`service_order`) e o subitem (`service_order_item`) são agregados comuns com versão, porque produção, entrega e reconciliação vão mudar cada subitem sozinho nas entregas seguintes. Os cinco nascem juntos pelo comando `quote.approve`, com o agregado `quoteApproval`, numa transação só e idempotente pelo `opId`. O código `OS-<ano>-PC-<número>` vem do ano da data do aceite, com contador por ano e sigla, pelo `documentCode` do orçamento.

**Quem decide o quê.** O aparelho manda todos os ids (aprovação, OS, recebível, um por subitem e um por reserva prevista) e o snapshot de medidas, composto da medição atual de cada modelo do perfil da linha, a mesma que a ficha mostra. O servidor confere que os subitens são exatamente as linhas de serviço, peça sob medida e material da última revisão, na ordem, que cada medição existe e é do perfil da linha, e calcula as reservas na gravação: subitens na ordem das linhas, variantes na ordem em que aparecem na linha, cada uma reservando o disponível (físico somado de todos os locais e lotes menos todas as reservas, as desta aprovação inclusive). Reserva de zero não é gravada; a falta (previsto menos reservado) é derivada na leitura, nunca gravada. O recebível nasce com o total da revisão e a data do aceite, e total zero não cria recebível.

**Anonimização.** Cliente com OS ou recebível com valor é recusado antes de qualquer escrita, com "Cliente com OS aberta ou valor a receber". A redação de OS encerrada e de documento emitido fica para quando o encerramento existir; até lá a aprovação, a OS e o subitem entram em `personalDataAggregates`, e toda quarentena de `quote.approve` grava o hash redigido.

## Opções consideradas

- **OS com subitens em JSON:** uma linha só, mas cada avanço de produção ou entrega trocaria a lista inteira, e a reserva por subitem apontaria para dentro de um JSON.
- **Híbrida, com reserva e recebível em colunas da OS:** menos tabelas, mas reserva por variante e recebível com parcelas não cabem em colunas, e o fato imutável ficaria dentro de um agregado mutável.
- **Reserva calculada no aparelho:** a prévia já mostra a conta, mas duas aprovações em aparelhos diferentes reservariam o mesmo disponível; o servidor é quem vê todas as reservas na hora de gravar.
- **Servidor copiando as medições atuais:** dispensaria o snapshot no payload, mas o que fica congelado poderia ser diferente do que o dono viu na prévia se outra janela registrasse uma medição no meio.
- **Anonimizar redigindo a OS:** resolveria o pedido do titular, mas a OS em andamento precisa do nome para a entrega e a cobrança; a decisão volta com o encerramento.

## Consequências

- O orçamento aprovado fica só leitura, com o link da OS: a emissão recusa o aprovado com "Orçamento já aprovado", e mudança de preço, prazo ou material chega com a revisão comercial, que exige nova aprovação e lança só a diferença.
- Desfazer uma aprovação feita por engano fica para o cancelamento da OS; até lá a reserva e o recebível ficam.
- O índice único de recebível por OS vale enquanto cada OS tem uma cobrança só; se a revisão comercial lançar a diferença como recebível próprio, o índice cai numa migration para a frente.
- O servidor confere que a medição existe e é do perfil, não que é a mais recente: a tela garante a leitura feita depois de abrir o diálogo, e uma correção no meio da aprovação congela o que estava na tela.
- A pendência de abastecimento é derivada: comprar material não cobre a pendência sozinho, e a lista de compras consolidada vai ler previsto menos reservado.
- Na F6, o aparelho offline gera o código com a própria sigla, e a reserva otimista no aparelho é decidida lá; o servidor continua recalculando na gravação.

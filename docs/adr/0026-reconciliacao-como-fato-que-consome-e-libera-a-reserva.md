---
status: accepted
date: 2026-09-25
---

# Reconciliação de materiais como fato que consome o estoque e libera a reserva

O RF-EST-12 exige a reconciliação antes do "Pronto" da peça. O RF-EST-10 pede o lote mais antigo sugerido, com troca e divisão, o RF-EST-11 pede a troca de material com motivo e diferença de custo, e o RF-EST-15 pede que o consumo aceite saldo negativo com custo provisório. O [ADR 0025](0025-fluxo-de-producao-como-agregado-com-copia-na-os.md) deixou o "Pronto" da peça com material planejado esperando a reconciliação, e o [ADR 0024](0024-aprovacao-como-fato-que-cria-a-os.md) gravou a reserva como fato append-only, sem forma de liberá-la. Antes do schema era preciso decidir quando o material sai do estoque, onde mora o registro do previsto, do usado e do perdido, e como a reserva deixa de contar.

**O material sai só na reconciliação.** Durante a produção, a reserva segura o material e o disponível continua certo. No "Marcar pronto" da peça, na última etapa, uma única operação grava:
- o fato `material_reconciliation`, append-only, com uma linha por material planejado: previsto, variante usada (e o motivo, se trocou), consumido e perdido;
- as partes por local e lote, cada uma com o valor, a quantidade provisória e o valor provisório;
- um movimento `consumption` por parte;
- o subitem em `ready`, pelo `update` com compare-and-set.

O que não saiu é a sobra da reconciliação, sem movimento. O consumido e o perdido saem juntos no mesmo movimento, e a divisão entre os dois mora só na linha do fato.

**Valor da saída.** Cada parte sai pela média do ponto, sobre o saldo que as partes anteriores deixaram, pela mesma função do domínio no servidor e na prévia. O que passa do saldo é provisório: vale a média do ponto quando ele ainda tinha saldo, senão o custo de referência, senão zero. Ponto com quantidade positiva e valor negativo (sobra de um negativo antes do ajuste de custo) não tem média, e a parte inteira sai provisória pela referência; o brinde a R$ 0 tem média zero. A parte guarda o provisório para o ajuste de custo que virá com a compra.

**Reserva liberada por derivação.** Uma reserva cujo subitem tem reconciliação ativa (sem `material_reconciliation_reversal`) deixa de somar no reservado da variante. Nada é gravado na reserva.

**Correção por estorno.** O estorno é outro fato, com índice único por reconciliação. Ele grava o movimento contrário de cada parte e tira a peça de "Pronto". O estorno avulso de um movimento de consumo é recusado, no molde do movimento de compra.

## Opções consideradas

- **Retirada durante a produção e acerto no fim:** mais fiel ao corte do tecido, mas cria estado intermediário, devolução como movimento e reserva parcialmente consumida.
- **Só movimentos, com a data da reconciliação no subitem:** menos tabelas, mas o previsto, o perdido e o motivo da troca ficam sem lugar, e o estorno de um movimento só desalinha a peça.
- **Liberação da reserva como fato negativo:** o reservado ficaria numa soma simples, mas o estorno teria que reservar de novo, e a trigger e o `quantity > 0` da reserva mudariam.
- **Movimento `loss` separado para o perdido:** a perda apareceria no histórico do estoque, mas cada parte teria que se dividir entre consumido e perdido. O tipo de movimento é formato publicado no sync, e nenhuma leitura usa a perda separada ainda.

## Consequências

- Toda soma do reservado da variante passa pela mesma condição. A falta por subitem ignora o subitem reconciliado.
- Material gasto a mais depois do "Pronto" se registra estornando e reconciliando de novo com o total.
- O ajuste de custo na compra que cobre um ponto negativo, a liberação da reserva do subitem de material e o material não planejado ficam para as entregas seguintes.
- A recusa do estorno de subitem já entregue nasce com a entrega parcial.

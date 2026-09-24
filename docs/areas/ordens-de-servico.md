# Ordens de serviço: aprovação, OS, subitens, reservas e recebível

**Files:** `packages/domain/src/service-order.ts`, `packages/domain/src/reservation.ts`, `packages/domain/src/quote.ts` (`quoteStatus`, `documentSearchKey`), `packages/db/src/schema/service-orders.ts`, `packages/db/src/migrations/0018_service_orders_approvals_reservations.sql`, `packages/db/src/migrations/0019_service_order_facts_append_only.sql`, `packages/api/src/service-orders/schemas.ts`, `packages/api/src/service-orders/store.ts`, `packages/api/src/service-orders/commands.ts`, `packages/api/src/service-orders/queries.ts`, `packages/api/src/service-orders/router.ts`, `packages/api/src/stock/reservations.ts`, `packages/api/src/finance/receivables.ts`, `packages/api/src/quotes/queries.ts`, `packages/api/src/quotes/router.ts`, `packages/api/src/clients/anonymize.ts`, `packages/api/src/global-search/queries.ts`, `apps/web/src/lib/service-orders.ts`, `apps/web/src/quotes/approve-dialog.tsx`, `apps/web/src/quotes/approved-quote.tsx`, `apps/web/src/quotes/quote-actions.tsx`, `apps/web/src/service-orders/`, `apps/web/src/routes/_app/os/`, `apps/web/src/routes/_app/orcamentos/aprovados.tsx`, `packages/domain/src/service-order.test.ts`, `packages/domain/src/reservation.test.ts`, `packages/db/tests/service-orders-schema.test.ts`, `apps/server/tests/service-orders.test.ts`, `apps/server/tests/service-orders-sync.test.ts`, `apps/server/tests/service-orders-anonymization.test.ts`, `apps/web/tests/service-orders.test.ts`

## Overview

A aprovação registra o aceite do cliente sobre a última revisão emitida do orçamento e, na mesma operação, abre a OS: um subitem por linha de serviço, peça sob medida e material da revisão, o snapshot das medidas atuais de cada perfil, as reservas do disponível e o recebível com o total ([ADR 0024](../adr/0024-aprovacao-como-fato-que-cria-a-os.md)). O orçamento aprovado fica só leitura, com o link da OS.

Aprovação, reserva e recebível são fatos append-only; OS e subitem são agregados comuns no molde de [agregados](agregados.md), com dado pessoal (o cliente), porque produção, entrega e reconciliação vão mudar cada subitem sozinho. Revisão comercial, cancelamento, consumo, etapas, entrega, parcelas e pagamentos chegam nas entregas seguintes.

## Agregados e fatos

| Onde | Tipo | Campos |
|---|---|---|
| `service_order` | agregado `serviceOrder` | `client_id`, `quote_id` (único), `code` (único, `OS-<ano>-PC-<número de 4 dígitos>`), `code_year`, `code_device`, `code_number` (único por ano, sigla e número), `opened_on` (a data do aceite), `search_text` (código e títulos dos subitens), `version` |
| `quote_approval` | fato `quoteApproval` | `quote_id`, `revision_id` (único), `service_order_id`, `approved_on`, `channel` (`inPerson`, `whatsapp`, `phone`, `email`, `other`), `note` (até 200), `version` 1 |
| `service_order_item` | agregado `serviceOrderItem` | `service_order_id`, `line_id` (único por OS), `position` (a partir de 0, na ordem das linhas), `kind` (`service`, `custom`, `material`), `line` (a linha congelada inteira da revisão), `measurements` (snapshot, até 50), `due_on` (prazo combinado ou nulo), `version` |
| `stock_reservation` | fato `stockReservation` | `service_order_item_id`, `variant_id`, `kind` `approval`, `quantity_micros` (maior que zero), `occurred_on`, `version` 1 |
| `receivable` | fato `receivable` | `kind` `serviceOrder`, `client_id`, `service_order_id` (único, nulo para a venda direta futura), `amount_cents` (total da revisão), `occurred_on` (a data do aceite, que é a do faturamento), `version` 1 |

As triggers `*_no_update` e `*_no_delete` da migration `0019` recusam mudar ou apagar aprovação, reserva e recebível com "`<tabela>` é append-only". A OS e o subitem não têm trigger: são agregados que a entrega da produção vai editar.

## A aprovação

`quote.approve` (agregado `quoteApproval`, pela procedure `quotes.approve` e pelo push) recebe do aparelho todos os ids e o snapshot:

| Campo | Regra |
|---|---|
| `approvedOn` | entre a emissão e o "válido até" da revisão, os dois extremos valendo (`approvalWindowError`); a tela sugere hoje limitado à validade e nunca aceita data futura |
| `channel` | um dos cinco canais, obrigatório |
| `note` | opcional, até 200, aparada |
| `dueOn` | prazo combinado, nulo ("a combinar") ou maior ou igual ao aceite; a tela sugere aceite mais o prazo proposto da revisão (`suggestedDueOn`) |
| `items` | um por linha de trabalho da revisão, na ordem, com `itemId`, `lineId`, `measurements` e uma `reservationId` por variante de `linePlannedMaterials`, na ordem |
| ids | `approvalId`, `serviceOrderId`, `receivableId`, `itemId` e `reservationId` todos distintos ("Id repetido") |

Recusas, nesta ordem: orçamento inexistente; cliente anonimizado; orçamento já aprovado (`aggregateExists`, "Orçamento já aprovado"); revisão inexistente ou de outro orçamento ("Revisão não encontrada"); revisão que não é a última ("Revisão substituída por outra mais nova"); aceite fora da janela ("Data fora da validade da revisão"); subitens diferentes das linhas de trabalho, medição em linha de material ou sem perfil, ou variantes das reservas fora da ordem ("Subitens não conferem com a revisão"); medição inexistente ou de outro perfil ("Medição não encontrada"); id já usado (`aggregateExists`). Aceita, a aprovação grava a OS, a aprovação, os subitens, as reservas maiores que zero e o recebível quando o total é maior que zero, e limpa a recusa do orçamento na mesma transação.

## A reserva

`planReservations` (`packages/domain/src/reservation.ts`) percorre as necessidades na ordem (subitens na ordem das linhas, variantes na ordem de primeira aparição na linha) e cada uma reserva o disponível da variante naquele ponto: físico somado de todos os locais e lotes (`stock_balance`) menos todas as reservas gravadas, menos o que as necessidades anteriores desta aprovação já levaram. Reserva de zero não vira linha. A falta é previsto menos reservado, calculada na leitura.

| Linha | Previsto | Disponível antes | Reserva | Falta |
|---|---|---|---|---|
| Crepe preto da peça, com 2,50 m no armário e 1,00 m reservado por outra OS | 3,40 m | 1,50 m | 1,50 m | 1,90 m |
| Zíper da peça, com 5 un | 1 un | 5 un | 1 un | 0 |
| Zíper da linha de material | 2 un | 4 un | 2 un | 0 |

O disponível aparece em Saldos, na ficha do material e nos materiais previstos de outro orçamento; com filtro de local, Saldos mostra só "reservado X em todos os locais", porque a reserva é da variante inteira.

## Estado do orçamento

`quoteStatus` põe "aprovado" à frente de recusa e vencimento: o aprovado com recusa e validade vencida lista só em Aprovados. A lista filtra os outros estados com `NOT EXISTS` em `quote_approval` e traz `approvedOn` e `serviceOrderCode`. A emissão recusa o aprovado com "Orçamento já aprovado".

## Leituras

| Procedure | Devolve |
|---|---|
| `serviceOrders.list` | OS pela data do prazo mais próximo (sem prazo por último), depois a mais nova; busca por código, dígitos, títulos dos subitens e cliente (`serviceOrderMatches`); `itemCount`, `dueOn`, `totalCents` do recebível e `shortage` quando algum subitem tem falta |
| `serviceOrders.get` | a OS, o cliente, o orçamento, a aprovação, a revisão aprovada (totais, custo e meta), os subitens com as reservas por variante na ordem da linha e o recebível; "OS não encontrada" |
| `quotes.get` | `approval` com o código e o id da OS, e `stock` com `reservedMicros` das variantes do rascunho e da última revisão |
| `stockBalances.list`, `stockBalances.get`, `materials.get` | `reservedMicros` por variante; o detalhe da variante lista as reservas por subitem com `itemId`, código da OS e título do subitem |

## Anonimização

`anonymizeClient` recusa, depois da versão conferida e antes de qualquer escrita, cliente com OS ou com recebível de valor maior que zero, com "Cliente com OS aberta ou valor a receber". A web mostra "Este cliente tem OS aberta ou valor a receber. A anonimização fica disponível quando tudo estiver encerrado." A redação de OS encerrada fica para quando o encerramento existir.

## Telas

| Tela | O que mostra |
|---|---|
| Diálogo "Registrar aprovação" | data do aceite, canal em `ChoiceChips` num `Fieldset`, nota, prazo combinado com "Usar prazo sugerido", aviso de alterações não emitidas e a prévia "O que a aprovação cria" (subitens, medidas congeladas, reservas com falta destacada, linha livre só no valor, total a receber); lê as medidas do cliente ao abrir e a cada 15 s, e só libera o envio com leitura feita depois da abertura (`approvalBlocker`), com "Tentar de novo" quando a leitura falha |
| Orçamento aprovado | painel da aprovação com "Abrir OS-...", linhas congeladas, totais, painel interno e revisões; só "Arquivar" |
| Lista de OS (`/os`) | código, cliente e subitens, prazo com "vencido", a receber ou "sem cobrança", "aberta" e "falta material" |
| Página da OS (`/os/$osId`) | cabeçalho, faixa Produção, Entrega e Financeiro, um cartão por subitem com snapshot ("Ver medidas") e materiais (Previsto, Reservado, Falta), recebível, painel "Só para você" com custo e margem estimados e encerramento com os três itens |

## Armadilhas

- A OS nasce da última revisão, não do rascunho: com alterações não emitidas, o diálogo avisa que elas ficam de fora.
- Os ids da aprovação ficam num `ref` por revisão e o `opId` cobre o payload inteiro (`${approvalId}:${canonicalJson(fields)}`): resposta perdida seguida de nova tentativa repete a mesma operação, e "Registro já existe" vira aviso e leva à OS.
- Em duas janelas, o refetch por foco troca a página para o orçamento aprovado antes do segundo envio; "Orçamento já aprovado" só chega na corrida, e a tela relê a aprovação e abre a OS com "Este orçamento já tinha sido aprovado em outra janela."
- A reserva é do servidor: a prévia calcula com o físico e o reservado de `quotes.get`, mas outra aprovação no meio muda o resultado gravado.
- Snapshot vem da medição atual de cada modelo do perfil (`currentByTemplate`), o mais recente primeiro; corrigir a medida depois não muda a OS (CA-02).
- Snapshot montado com a leitura da página congelava a medida velha: com duas janelas visíveis o TanStack Query não relê, e a correção feita na outra janela ficava de fora. O diálogo lê as medidas ao montar (`refetchOnMount: "always"`), relê a cada 15 s e só envia com `isSuccess` e `isFetchedAfterMount`; sem leitura, a prévia recebe `null` e não afirma que o perfil está sem medida.
- Recusa da aprovação por revisão substituída, data ou medição relê o orçamento e as medidas: sem isso o diálogo repetia a mesma recusa até recarregar a página.
- "Orçamento já aprovado" é `exists` para a aprovação (a OS já está lá), mas na emissão é recusa: `quoteAlreadyApproved` separa os dois, e a emissão mostra "Este orçamento já foi aprovado." no lugar do aviso de revisão já emitida.
- A página da peça sob medida (`/pecas/nova` e `/pecas/$linhaId`) é rota própria e não passa pela troca da página do orçamento: ela confere a aprovação e mostra o aviso, sem o editor.

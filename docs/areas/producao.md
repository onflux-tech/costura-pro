# Produção: fluxo de produção, produção por subitem, quadro por etapa e reconciliação de materiais

**Files:** `packages/domain/src/production.ts`, `packages/domain/src/production.test.ts`, `packages/db/src/schema/production.ts`, `packages/db/src/schema/service-orders.ts`, `packages/db/src/schema/services.ts`, `packages/db/src/migrations/0020_production_flow.sql`, `packages/api/src/production/schemas.ts`, `packages/api/src/production/store.ts`, `packages/api/src/production/seed.ts`, `packages/api/src/production/commands.ts`, `packages/api/src/production/router.ts`, `packages/api/src/service-orders/production.ts`, `packages/api/src/service-orders/store.ts`, `packages/api/src/service-orders/queries.ts`, `packages/api/src/service-orders/router.ts`, `packages/api/src/services/schemas.ts`, `apps/server/src/app.ts`, `packages/ui/src/components/checkbox-chips.tsx`, `apps/web/src/lib/production.ts`, `apps/web/src/lib/service-orders.ts`, `apps/web/src/lib/services.ts`, `apps/web/src/production/`, `apps/web/src/service-orders/item-production.tsx`, `apps/web/src/service-orders/service-order-flow.tsx`, `apps/web/src/services/service-form.tsx`, `apps/web/src/routes/_app/producao/`, `packages/db/tests/production-schema.test.ts`, `apps/server/tests/production-flow.test.ts`, `apps/server/tests/production-flow-sync.test.ts`, `apps/server/tests/service-order-fixtures.ts`, `apps/server/tests/service-orders-production.test.ts`, `apps/server/tests/service-orders-production-sync.test.ts`, `apps/web/tests/production.test.ts`, `apps/web/tests/production-queries.test.ts`, `packages/domain/src/reconciliation.ts`, `packages/domain/src/reconciliation.test.ts`, `packages/db/src/schema/reconciliation.ts`, `packages/db/src/migrations/0021_material_reconciliation.sql`, `packages/db/src/migrations/0022_material_reconciliation_append_only.sql`, `packages/api/src/reconciliation/schemas.ts`, `packages/api/src/reconciliation/store.ts`, `packages/api/src/reconciliation/commands.ts`, `packages/api/src/stock/reservations.ts`, `apps/web/src/lib/reconciliation.ts`, `apps/web/src/service-orders/reconcile-dialog.tsx`, `apps/web/src/service-orders/reverse-reconciliation-dialog.tsx`, `apps/web/src/service-orders/reconciled-materials.tsx`, `apps/web/src/service-orders/use-reconciliation-actions.ts`, `apps/web/src/service-orders/service-order-internal-panel.tsx`, `packages/db/tests/reconciliation-schema.test.ts`, `apps/server/tests/material-reconciliation.test.ts`, `apps/server/tests/material-reconciliation-sync.test.ts`, `apps/web/tests/reconciliation.test.ts`

## Overview

O dono mantém um fluxo de produção único e versionado; cada OS guarda a cópia da versão com que nasceu, e cada subitem de serviço ou peça anda sozinho pelas etapas escolhidas ao iniciar, de "A iniciar" a "Pronto" ([ADR 0025](../adr/0025-fluxo-de-producao-como-agregado-com-copia-na-os.md)). O serviço sugere etapas; o destino Produção mostra o quadro por etapa e a sub-aba que edita o fluxo. A peça com material planejado chega ao "Pronto" pela reconciliação de materiais, que tira o material do estoque, libera a reserva e se corrige por estorno ([ADR 0026](../adr/0026-reconciliacao-como-fato-que-consome-e-libera-a-reserva.md)); o calendário de prazos vem com a agenda.

## Onde mora cada coisa

| Onde | O quê |
|---|---|
| `production_flow` (agregado `productionFlow`, uma linha) | `stages` em JSON (`{ active, id, name }[]`), `version` como versão do fluxo; semeado no boot por `ensureProductionFlow` com Corte, Montagem, Prova e Acabamento, `opId` nulo no `change_log` |
| `service_order` | `flow_version` e `flow_stages`, a cópia inteira (ocultas inclusive) do fluxo vigente na aprovação; nulos na OS aprovada antes do fluxo |
| `service_order_item` | `production_status` (`notStarted`, `inProgress`, `ready`), `stage_ids` (aplicáveis congeladas) e `stage_id` (atual); o de material fica sempre `notStarted` |
| `service` | `suggested_stage_ids`, até 50 ids distintos, sem filtro pelo fluxo na gravação |

## Regras do domínio

| Função | Regra |
|---|---|
| `mergeFlowStages(atual, enviadas)` | enviadas ativas na ordem; depois as atuais ausentes do envio, ocultas, na ordem atual e com o nome gravado |
| `sameFlowStages(a, b)` | mesmo tamanho e, posição a posição, mesmos `id`, `name` e `active`; igual vira "sem efeito" |
| `startProduction(estado, flowStages, escolha)` | só em `notStarted`; aplicáveis = ativas do fluxo da OS que estão na escolha, na ordem do fluxo; vazia é `null` |
| `advanceProduction(estado, awaitingReconciliation)` | só em `inProgress`; próxima aplicável, ou `ready` da última quando a linha não tem material planejado ou já tem reconciliação ativa |
| `backProduction(estado)` | uma aplicável para trás; da primeira a `notStarted` com escolha nula; de `ready` à última |
| `suggestedStageIds(flowStages, listas)` | união filtrada às ativas, na ordem do fluxo; vazia vira todas as ativas |

Exemplo (fluxo v1 Corte C, Montagem M, Prova P, Acabamento A):

| Subitem | Sugestão | Início | Avanços | Resultado |
|---|---|---|---|---|
| Serviço "Ajuste de cava" (sugere P, A) | P, A | P, A em P | A, depois Pronto; voltar volta a A | `ready` e de volta a `inProgress` |
| Peça com crepe e "Costura de vestido" (sugere C, M, P, A) | C, M, P, A | C, M, A em C | M, A; avançar em A fica sem efeito | em A com "Reconciliar e marcar pronto"; a reconciliação leva a `ready` |
| Material Zíper | sem produção | `NOT_FOUND` | | "Só entrega, sem produção" |

Na v2 (Montagem renomeada para Costura, Prova oculta, Passadoria no fim) a lista fica `[C, M "Costura", A, S "Passadoria", P oculta]`; a OS em v1 continua mostrando "Montagem" e "Prova" até o "Usar a versão nova", que troca nomes e ordem e preserva `stage_ids`.

## Comandos e leituras

| Procedure | Comando | Observação |
|---|---|---|
| `productionFlow.get` | leitura | `{ id, stages, version, updatedAt }` |
| `productionFlow.update` | `productionFlow.update` | 1 a 12 etapas, nome aparado de 1 a 30, "Etapa repetida" e "Nome de etapa repetido" (pelo `duplicateLabelIndex`); mesma lista não gera versão |
| `serviceOrders.adoptCurrentFlow` | `serviceOrder.adoptCurrentFlow` | copia o fluxo vigente; já na vigente é "sem efeito" |
| `serviceOrderItems.start`, `advance`, `back` | `serviceOrderItem.*` | `read` junta o `flow_stages` da OS e a anonimização do cliente; transição que não se aplica é "sem efeito"; subitem de material é `NOT_FOUND` "Subitem de produção não encontrado" |
| `serviceOrderItems.board` | leitura | subitens `service` e `custom` de todas as OS, pelo prazo, código e posição, com as OS e o fluxo vigente |
| `serviceOrders.get`, `serviceOrders.list` | leitura | a OS ganha `currentFlowVersion` e cada subitem `suggestedStageIds`; a lista ganha `productionCount`, `startedCount` e `readyCount` |

## Telas

| Tela | O que mostra |
|---|---|
| Quadro (`/producao/quadro`) | "Quadro por etapa", "fluxo v<N> · <n> subitens" e "Editar fluxo"; a partir de 1280 px um `Panel` por coluna numa grade que quebra linha; abaixo, `Tabs` por coluna com a aba no parâmetro `etapa`; cartão com título, "<código> · subitem <n>", cliente, prazo, selos "atrasado" e "bloqueado · falta <material>" e as ações; OS sem fluxo leva a "Abrir OS" |
| Fluxo de produção (`/producao/fluxo`) | "versão <N>", "A iniciar" e "Pronto" fixos, "Nome da etapa <i>" com Subir, Descer e Ocultar, "Adicionar etapa", painel "Ocultas" com Mostrar, "Salvar versão <N + 1>" só com mudança, "Descartar alterações", conflito com "Carregar versão atual" |
| Página da OS | linha "Fluxo de produção v<N>" com "Usar a versão nova (v<M>)" ou "Esta OS é anterior ao fluxo de produção." com "Usar o fluxo v<M>"; faixa Produção com o resumo e tom de perigo com atraso ou bloqueio; no cartão, "Etapa atual", trilha, "Iniciar produção", "Avançar para <etapa>", "Marcar pronto" ou, na peça com material, "Reconcilie os materiais para marcar pronto." com "Reconciliar e marcar pronto", e "Voltar etapa" |
| Diálogo "Iniciar produção" | `CheckboxChips` com as ativas do fluxo da OS pré-marcadas pela sugestão; "Escolha ao menos uma etapa." |
| Cadastro de serviço | `Fieldset` "Etapas sugeridas" com as ativas do fluxo vigente |
| Lista de OS | "Produção: <resumo>" abaixo dos selos |

## Reconciliação de materiais

Na última etapa aplicável, a peça com material planejado abre o diálogo "Reconciliação de materiais" pelo cartão da OS ou do quadro. Uma operação grava o fato, um movimento `consumption` por saída e o subitem em `ready`.

| Onde | O quê |
|---|---|
| `material_reconciliation` (fato `materialReconciliation`) | `service_order_item_id`, `occurred_on`, `note`, `lines` (uma por variante planejada, na ordem: previsto, variante usada, motivo da troca, consumido, perdido e as saídas com local, lote, quantidade, valor e o provisório) e `version` 1; append-only por trigger |
| `material_reconciliation_reversal` (fato `materialReconciliationReversal`) | `reconciliation_id` (índice único), `occurred_on`, `reason`; append-only |
| `stock_movement` | `kind` `consumption` com quantidade e valor negativos e `material_reconciliation_id`; o estorno é `reversal` com o mesmo vínculo |

| Regra | Como |
|---|---|
| Previsto | `linePlannedMaterials` da linha congelada, conferido pelo servidor ("Materiais não conferem com o subitem") |
| Saída | consumido + perdido, igual à soma das saídas; sobra da reconciliação = previsto − saída, sem movimento; o que passa do previsto aparece como "a mais" (`reconciliationOutcome`) |
| Lote sugerido | `suggestConsumptionParts`: pontos com saldo positivo, lote mais antigo por `created_at`, depois o nome do local; o que falta soma na última saída |
| Valor | `consumptionPartValue`: o que cabe no saldo positivo sai pela média do ponto; o excesso é provisório, pela média quando o ponto ainda tinha saldo, senão pelo custo de referência da variante usada, senão zero; as saídas se valorizam em sequência, cada uma sobre o saldo que as anteriores deixaram, e a prévia da tela (`linePreview`) usa a mesma função |
| Troca | outra variante com a mesma unidade base ("Troca precisa de material com a mesma unidade") e motivo obrigatório |
| Reserva | a do subitem com reconciliação ativa sai do reservado da variante (`unreleasedReservation`) e da falta; o estorno a devolve |
| Voltar e estorno | "Voltar" de `ready` mantém a reconciliação, e o avanço seguinte volta direto a `ready`; o estorno desfaz as saídas pelo mesmo valor e tira o subitem de `ready`; material gasto a mais se registra estornando e reconciliando de novo |

Exemplo (crepe preto com 2,50 m e R$ 75,00 no Armário; peça com 3,40 m de crepe e 1 zíper planejados): consumido 3,20 m e perdido 0,20 m numa saída de 3,40 m; 2,50 m cobertos saem por R$ 75,00 e 0,90 m provisórios por R$ 27,00 (média de R$ 30,00/m), e o ponto fica em −0,90 m e −R$ 27,00; o zíper sai por R$ 3,70. O painel "Só para você" mostra o crepe previsto a R$ 102,00 contra o real, com "provisório".

| Procedure | Comando | Observação |
|---|---|---|
| `serviceOrderItems.reconcile` | `materialReconciliation.create` | recusas: "Subitem já reconciliado" (`CONFLICT`), "O subitem não está na última etapa", "Materiais não conferem com o subitem", "Troca precisa de material com a mesma unidade", local ou lote inválido e id já usado |
| `serviceOrderItems.reverseReconciliation` | `materialReconciliation.reverse` | `movementIds` na ordem das saídas; "Reconciliação já estornada" (`CONFLICT`) e "Reconciliação não encontrada" |
| `stockBalances.variantPoints` | leitura | pontos com saldo das variantes pedidas, com `lotCreatedAt` e o custo de referência, para a sugestão e a prévia |

## Armadilhas

- A chave do `opIdFor` é `<itemId>:<ação>:<baseVersion>` (mais as etapas no início, e `<osId>:adoptCurrentFlow:<versão>` na OS), guardada por alvo (`opIdsByTarget`), então por cartão também no quadro, com o diálogo de iniciar recebendo a ação de quem o abre: resposta perdida seguida de nova tentativa repete o `opId` e o subitem anda uma vez. Uma ação diferente no mesmo cartão gera outro `opId`, mas sai com a mesma versão-base e recebe `Versão desatualizada`, então nunca anda duas etapas. A montagem da entrada e da chave mora na `lib`, testada com um `opIdFor` falso.
- "Sem efeito" não é sucesso: o início depende do fluxo copiado na OS, que a versão-base do subitem não cobre, então a outra janela pode trocar o fluxo e deixar a escolha sem etapa ativa. Resposta com a mesma versão enviada mostra "Nada mudou: este subitem ou o fluxo da OS mudou em outra janela. Confira e tente de novo.", relê e mantém o diálogo aberto; o início parcial segue como sucesso, porque a trilha mostra as etapas reais.
- `failedProductionCommand` relê sempre a produção depois do erro; o conflito mostra "Este subitem mudou em outra janela. Confira e tente de novo." no subitem, "Esta OS mudou em outra janela ou aparelho." na troca de fluxo e o assunto "fluxo" no editor.
- O diálogo de iniciar do quadro mora na página, não no cartão: o cartão desmonta quando muda de coluna e levava o diálogo junto.
- Quando o botão acionado some (iniciar, marcar pronto), o foco vai ao status "Etapa atual" do cartão; sem isso caía no `body`.
- A coluna da etapa oculta aparece no quadro só enquanto tem cartão, vem depois das ativas (porque `mergeFlowStages` põe as ocultas no fim da lista) e leva o rótulo "<nome> (oculta)": o limite de nome repetido vale só entre as ativas, e uma "Prova" nova ativa ao lado da oculta davam duas colunas iguais.
- O payload do fluxo leva só as ativas, e a fusão guarda a oculta com o nome e a posição salvos: o rascunho imita a fusão, então ocultar uma etapa salva mostra em "Ocultas" o nome salvo e a ordem que o servidor vai gravar, e "Mostrar" traz o nome salvo; etapa nova ainda não salva sai do rascunho. O teste confere que o rascunho é igual à fusão do domínio sobre o próprio payload.
- O campo do nome não tem `maxLength`, para o erro "Use até 30 caracteres." aparecer; a tela recusa nome vazio, longo e repetido por acento, caixa ou espaço antes de mandar.
- `servicePatch` compara as etapas sugeridas como conjunto: o `CheckboxGroup` devolve na ordem dos cliques, e a mesma escolha em outra ordem não gera patch.
- O fato da reconciliação é gravado antes dos movimentos, porque `stock_movement.material_reconciliation_id` tem chave estrangeira e o fato é imutável; os valores das saídas são calculados antes, numa projeção de saldo por ponto, e o subitem vai a `ready` por último, na mesma transação.
- O rascunho da reconciliação (id, saídas com os `movementId` e o `opIdFor`) mora na página, por subitem, e sobrevive a fechar e reabrir o diálogo; ele é descartado no sucesso, no `exists` e quando a leitura mostra o subitem `reconciled`. Sem o descarte pela leitura, uma resposta perdida seguida de estorno fazia toda nova tentativa receber "Registro já existe". O quadro chama o mesmo `forgetSettled` com os itens dele.
- O diálogo só monta o rascunho com os pontos lidos depois de abrir (`isFetchedAfterMount`, relidos a cada 15 s): a sugestão e a prévia do provisório dependem do saldo atual.

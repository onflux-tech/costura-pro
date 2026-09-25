# Produção: fluxo de produção, produção por subitem e quadro por etapa

**Files:** `packages/domain/src/production.ts`, `packages/domain/src/production.test.ts`, `packages/db/src/schema/production.ts`, `packages/db/src/schema/service-orders.ts`, `packages/db/src/schema/services.ts`, `packages/db/src/migrations/0020_production_flow.sql`, `packages/api/src/production/schemas.ts`, `packages/api/src/production/store.ts`, `packages/api/src/production/seed.ts`, `packages/api/src/production/commands.ts`, `packages/api/src/production/router.ts`, `packages/api/src/service-orders/production.ts`, `packages/api/src/service-orders/store.ts`, `packages/api/src/service-orders/queries.ts`, `packages/api/src/service-orders/router.ts`, `packages/api/src/services/schemas.ts`, `apps/server/src/app.ts`, `packages/ui/src/components/checkbox-chips.tsx`, `apps/web/src/lib/production.ts`, `apps/web/src/lib/service-orders.ts`, `apps/web/src/lib/services.ts`, `apps/web/src/production/`, `apps/web/src/service-orders/item-production.tsx`, `apps/web/src/service-orders/service-order-flow.tsx`, `apps/web/src/services/service-form.tsx`, `apps/web/src/routes/_app/producao/`, `packages/db/tests/production-schema.test.ts`, `apps/server/tests/production-flow.test.ts`, `apps/server/tests/production-flow-sync.test.ts`, `apps/server/tests/service-order-fixtures.ts`, `apps/server/tests/service-orders-production.test.ts`, `apps/server/tests/service-orders-production-sync.test.ts`, `apps/web/tests/production.test.ts`, `apps/web/tests/production-queries.test.ts`

## Overview

O dono mantém um fluxo de produção único e versionado; cada OS guarda a cópia da versão com que nasceu, e cada subitem de serviço ou peça anda sozinho pelas etapas escolhidas ao iniciar, de "A iniciar" a "Pronto" ([ADR 0025](../adr/0025-fluxo-de-producao-como-agregado-com-copia-na-os.md)). O serviço sugere etapas; o destino Produção mostra o quadro por etapa e a sub-aba que edita o fluxo. O "Pronto" de subitem com material planejado espera a reconciliação, que chega numa entrega própria, e o calendário de prazos vem com a agenda.

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
| `advanceProduction(estado, temMaterial)` | só em `inProgress`; próxima aplicável, ou `ready` da última quando `linePlannedMaterials` está vazio |
| `backProduction(estado)` | uma aplicável para trás; da primeira a `notStarted` com escolha nula; de `ready` à última |
| `suggestedStageIds(flowStages, listas)` | união filtrada às ativas, na ordem do fluxo; vazia vira todas as ativas |

Exemplo (fluxo v1 Corte C, Montagem M, Prova P, Acabamento A):

| Subitem | Sugestão | Início | Avanços | Resultado |
|---|---|---|---|---|
| Serviço "Ajuste de cava" (sugere P, A) | P, A | P, A em P | A, depois Pronto; voltar volta a A | `ready` e de volta a `inProgress` |
| Peça com crepe e "Costura de vestido" (sugere C, M, P, A) | C, M, P, A | C, M, A em C | M, A; avançar em A fica sem efeito | parada em A até a reconciliação |
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
| Página da OS | linha "Fluxo de produção v<N>" com "Usar a versão nova (v<M>)" ou "Esta OS é anterior ao fluxo de produção." com "Usar o fluxo v<M>"; faixa Produção com o resumo e tom de perigo com atraso ou bloqueio; no cartão, "Etapa atual", trilha, "Iniciar produção", "Avançar para <etapa>" ou "Marcar pronto", "Voltar etapa" e o aviso da reconciliação |
| Diálogo "Iniciar produção" | `CheckboxChips` com as ativas do fluxo da OS pré-marcadas pela sugestão; "Escolha ao menos uma etapa." |
| Cadastro de serviço | `Fieldset` "Etapas sugeridas" com as ativas do fluxo vigente |
| Lista de OS | "Produção: <resumo>" abaixo dos selos |

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

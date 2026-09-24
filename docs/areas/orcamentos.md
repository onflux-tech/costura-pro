# Orçamentos: rascunho, linhas, contas, revisões e estado

**Files:** `packages/domain/src/quote.ts`, `packages/db/src/schema/quotes.ts`, `packages/db/src/migrations/0016_quotes_revisions.sql`, `packages/db/src/migrations/0017_quote_revision_append_only.sql`, `packages/api/src/quotes/schemas.ts`, `packages/api/src/quotes/store.ts`, `packages/api/src/quotes/commands.ts`, `packages/api/src/quotes/queries.ts`, `packages/api/src/quotes/router.ts`, `packages/api/src/clients/anonymize.ts`, `packages/api/src/global-search/queries.ts`, `apps/web/src/lib/quotes.ts`, `apps/web/src/lib/quote-drafts.ts`, `apps/web/src/quotes/`, `apps/web/src/routes/_app/orcamentos/`, `packages/domain/src/quote.test.ts`, `packages/db/tests/quotes-schema.test.ts`, `apps/server/tests/quotes.test.ts`, `apps/server/tests/quotes-sync.test.ts`, `apps/server/tests/quotes-anonymization.test.ts`, `apps/web/tests/quotes.test.ts`, `apps/web/tests/quote-drafts.test.ts`

## Overview

O orçamento é o rascunho que o dono monta para um cliente pagador, sempre editável; cada emissão grava uma revisão numerada e congelada, com o conteúdo, os totais, o custo e a meta do momento ([ADR 0023](../adr/0023-orcamento-rascunho-com-revisao-emitida-como-fato.md)). Aceite parcial é uma revisão nova sem os itens recusados. A aprovação da última revisão abre a OS e deixa o orçamento só leitura ([ordens de serviço](ordens-de-servico.md)); o PDF chega depois.

O rascunho é agregado comum no molde de [agregados](agregados.md), com dado pessoal (o cliente); a revisão é fato criado de uma vez, como a compra e a sessão de inventário. Custo, preço sugerido, margem, avisos e materiais previstos aparecem só na tela do dono, calculados pelo domínio; o servidor calcula os totais só para congelar na emissão e para a lista.

## Agregados

| Onde | Campos |
|---|---|
| `quote` | `client_id`, `code` (único, `ORC-<ano>-PC-<número de 4 dígitos>`), `code_year`, `code_device`, `code_number` (índice único por ano, sigla e número), `created_on` (dia do orçamento, que dá o ano do código), `lines` (0 a 100), `discount`, `validity_days` (1 a 365, padrão 15), `lead_time_days` (1 a 365 ou nulo), `notes` (até 2000), `refused_on`, `refusal_reason` (até 200), `search_text`, `archived_at`, `version` |
| `quote_revision` | `quote_id`, `number` (único por orçamento), `content` (as linhas com `costCents`, `discountCents`, `grossCents` e `totalCents` de cada uma, o desconto, a validade, o prazo e as observações), `emitted_on`, `valid_until`, `reason` (até 200), `gross_cents`, `discount_cents` (linhas mais orçamento), `total_cents`, `cost_cents` (nulo com custo incompleto), `target_margin_basis_points`, `version` 1, e 2 depois da redação da anonimização |

O número do código é o maior do ano e da sigla mais 1; o ano vem de `created_on`. As triggers `quote_revision_update_only_redaction` e `quote_revision_no_delete` recusam mudar ou apagar a revisão, com exceção só da troca de `content` e `reason` da revisão registrada em `redacted_aggregate`, que sobe a versão exatamente uma vez.

## Linhas

| Tipo | Forma |
|---|---|
| Serviço | cópia de `serviceId`, `serviceName`, `serviceVersion`, `estimatedMinutes`, `outsourced`, `unitCostCents` e `catalogPriceCents`; `quantity` (1 a 9999), `unitPriceCents`, `profileId` e `receivedItemId` opcionais |
| Peça sob medida (`custom`) | `description` (1 a 120), `quantity` de peças, `unitPriceCents` por peça, `profileId` opcional, `source` (produto, versão e variante de onde a ficha foi copiada, ou nulo) e `components` (0 a 60) |
| Componente | material com cópia da variante (nome, código, unidade, precisão), `quantityMicros` por peça e `unitCostCents` editável ou nulo; serviço com cópia do serviço, `count` (1 a 99) e `unitCostCents` |
| Material | cópia da variante, `quantityMicros`, `unitCostCents` (nulo deixa o custo incompleto) e `unitPriceCents` por unidade da variante |
| Livre | `description`, `quantity`, `unitCostCents` (nulo deixa o custo incompleto; 0 é cobrança sem custo) e `unitPriceCents` |

Toda linha tem `id` do aparelho, `note` (até 200) e `discount` nulo, `{ kind: "amount", amountCents, reason }` ou `{ kind: "percent", basisPoints, reason }` (1 a 10000). Nomes, versões e custos são copiados na hora de acrescentar e não acompanham o catálogo; a linha nunca consulta o catálogo para se mostrar. Perfil e peça recebida entram só por id.

## A conta

Uma função do domínio para cada passo (`packages/domain/src/quote.ts`), chamadas pela tela por `quoteSummary` (`apps/web/src/lib/quotes.ts`) e pelo servidor na emissão e na lista:

| Passo | Regra |
|---|---|
| Bruto da linha | quantidade × preço; material por `multiplyHalfUp` (meio para cima ao centavo) |
| Desconto (`discountCents`) | valor fixo, ou bruto × pontos-base ÷ 10000 meio para cima; nunca maior que o bruto (o schema recusa) |
| Custo da linha | serviço: quantidade × custo; peça: custo por peça (`pieceCost`, nulo sem componente ou com material sem custo) × quantidade; material: `multiplyHalfUp`; livre: quantidade × custo |
| Totais (`quoteTotals`) | subtotal = soma dos totais das linhas; o desconto do orçamento incide sobre o subtotal e nunca passa dele; custo nulo com qualquer linha nula ou sem linhas |
| Preço | `pricingOf` com o total ao cliente, o custo e a meta do ateliê; com custo incompleto não há sugestão, margem nem aviso, só a lista do que falta |
| Materiais previstos (`plannedMaterials`) | material da linha mais componente × quantidade de peças, somados por variante, contra o disponível (físico menos o reservado por OS) lido em `quotes.get` |

Exemplo da verificação, com a meta de 40%: serviço R$ 160,00 com 10% (R$ 144,00, custo R$ 60,00), peça R$ 980,00 com Crepe 3,4 m a R$ 38,00, Forro 2,8 m a R$ 22,00, Zíper 60 cm a R$ 9,00 e Costura R$ 300,00 (custo R$ 499,80), zíper de 20 cm R$ 8,00 (custo R$ 3,70) e taxa de urgência R$ 50,00 com custo 0: subtotal R$ 1.182,00; com R$ 300,00 de desconto no orçamento, total R$ 882,00, custo R$ 563,50, sugestão R$ 939,17, margem 36,11% e "Faltam R$ 57,17 para atingir 40%".

## Estado

`quoteStatus` deriva o estado, nunca gravado: aprovado quando há aprovação, à frente de tudo; recusado quando `refused_on` existe; rascunho sem revisão; vencido quando o `valid_until` da última revisão é anterior ao dia de hoje da tela; emitido nos demais casos. A lista recebe `today` da tela e filtra por estado com o mesmo critério em SQL (aprovado por `EXISTS` em `quote_approval`, os outros com `NOT EXISTS`), e traz `approvedOn` e `serviceOrderCode`. Arquivado é independente do estado e sai das listas e da busca, salvo quando pedido.

## Comandos

| Comando | Agregado | Efeito |
|---|---|---|
| `quote.create` | `quote` | gera o código; recusa cliente inexistente ("Cliente não encontrado") e anonimizado |
| `quote.update` | `quote` | troca o conteúdo inteiro (linhas, desconto, validade, prazo, observações); conteúdo igual não escreve |
| `quote.refuse`, `.unrefuse` | `quote` | grava ou limpa data e motivo; os mesmos valores não escrevem |
| `quote.archive`, `.unarchive` | `quote` | regra de comando sem efeito de sempre |
| `quote.emit` | `quoteRevision` | cria a revisão com o número seguinte e os totais do conteúdo enviado, com a meta do ateliê do momento, e limpa a recusa; recusa orçamento inexistente ("Orçamento não encontrado"), de cliente anonimizado e aprovado ("Orçamento já aprovado"); exige pelo menos 1 linha |
| `quote.approve` | `quoteApproval` | aprova a última revisão e abre a OS com subitens, reservas e recebível; contrato, recusas e reserva em [ordens de serviço](ordens-de-servico.md) |

Os comandos rodam pela procedure direta e pelo `sync.push`, com as mesmas recusas. A emissão é criação da revisão e não confere a versão do rascunho: congela o que a tela mandou.

## Anonimização

`anonymizeQuotes` (`packages/api/src/clients/anonymize.ts`) limpa, no rascunho, as observações, a recusa, os motivos de desconto e as notas de linha, troca a descrição de peça e de linha livre por "Item anonimizado" e arquiva; em cada revisão faz o mesmo no `content` e apaga o `reason`, redigindo o histórico dos dois tipos antes de escrever a revisão, que ganha a versão 2 e uma mudança nova no `change_log`: o aparelho que já tinha puxado a revisão recebe a versão redigida no próximo pull. Valores, datas, código, números e nomes do catálogo ficam; o cliente anonimizado nunca aparece na busca.

## Telas

Orçamentos tem as sub-abas Rascunhos, Emitidos, Aprovados, Vencidos e Recusados, também no celular (Aprovados com "aprovado em" e o código da OS), e `/orcamentos` abre em Rascunhos. A lista tem busca por código, dígitos do código, cliente e título das linhas, e ativos ou arquivados. "Novo orçamento" vem da lista (com seletor de cliente) ou da ficha do cliente (`?cliente=`). A página do orçamento fica fora das abas e mostra o cabeçalho com código, estado e fatos, as ações (Registrar aprovação, principal quando o rascunho é igual à última revisão, Emitir revisão N, Registrar ou Desfazer recusa, Arquivar), os itens com menu por linha, os materiais previstos, as revisões emitidas, os totais e condições e o painel "Só para você". Serviço, material, linha livre e condições editam em diálogo que grava direto; a peça sob medida edita numa página própria (`/pecas/nova` e `/pecas/$linhaId`) com a cópia da ficha de um produto. A revisão tem página própria (`/revisoes/$numero`) com os valores congelados. O orçamento aprovado troca a página pelo painel da aprovação com "Abrir OS-...", as linhas congeladas da revisão aprovada, os totais, o painel interno e as revisões, só com "Arquivar".

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| Salvar uma linha ou tirar um item volta "Confira os campos e tente de novo." | O desconto do orçamento passaria do subtotal, e o schema recusa sem dizer o campo | A tela confere `documentDiscountFits` antes de mandar e explica o motivo |
| Nova tentativa da criação responde "opId reutilizado com conteúdo diferente" | O dia do orçamento é calculado no clique e entra no hash do servidor | A chave do `opIdFor` inclui o `createdOn` |
| Emissão com resposta perdida duplica a revisão, ou a emissão seguinte diz "Revisão N emitida" sem gravar nada | Id e `opId` sorteados de novo na nova tentativa; ou o mesmo id guardado depois que a revisão dele já foi gravada | `useDrafts` com a chave `emitir` guarda os dois até o sucesso e descarta o rascunho quando a revisão dele já aparece na lista; "Registro já existe" vira o aviso "Esta revisão já tinha sido emitida" |
| Resposta perdida ao criar para um cliente e troca de cliente abrem o orçamento do primeiro | O id do orçamento sorteado uma vez por página | Id e `opId` num rascunho por cliente (`useDrafts`), e "Registro já existe" vira o aviso "Este orçamento já tinha sido criado" |
| Emissão sem a confirmação de abaixo da meta | Avisos calculados com a meta padrão enquanto a do ateliê não carregou | "Emitir" fica desativado até a meta chegar, e o painel interno diz quando a leitura falhou |
| Diálogo de linha perde o que foi digitado com o orçamento mudado em outra janela | Fechar o diálogo na falha de versão | O diálogo mostra a falha e o próximo Salvar aplica a mudança na versão atual; ações da página mostram "Carregar versão atual" |
| Código do orçamento aparece cortado a 320 px | O `MobileHeader` trunca o título | O código fica visível também no painel do cabeçalho no celular |
| Margem da revisão antiga muda depois de mudar a meta | Recalcular com a meta atual | A revisão guarda a meta e o custo da emissão, e a página da revisão só formata |
| Emissão numa janela velha depois da aprovação na outra dizia "Esta revisão já tinha sido emitida" | "Orçamento já aprovado" é `exists` para a aprovação, e a emissão tratava todo `exists` como revisão já gravada | `quoteAlreadyApproved` devolve a recusa na emissão, e a releitura troca a página para o aprovado |
| Editor de peça grava no orçamento aprovado | A página da peça é rota própria, fora da troca da página do orçamento | A página da peça confere a aprovação e mostra o aviso, sem o editor |

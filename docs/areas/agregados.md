# Agregados

**Files:** `packages/api/src/sync/commands.ts`, `packages/api/src/update-command.ts`, `packages/api/src/aggregate-command.ts`, `packages/api/src/command-messages.ts`, `packages/api/src/redaction.ts`, `packages/api/src/operations.ts`, `packages/api/src/change-log.ts`, `packages/api/src/sync/push.ts`, `packages/api/src/sync/resolve.ts`, `packages/api/src/clients/`, `packages/api/src/measurements/`, `packages/api/src/received-items/`, `packages/api/src/materials/`, `packages/api/src/clients/anonymize.ts`, `packages/db/src/schema/clients.ts`, `packages/db/src/schema/measurements.ts`, `packages/db/src/schema/received-items.ts`, `packages/db/src/schema/materials.ts`, `packages/db/src/migrations/0004_change_log_redaction.sql`, `apps/server/src/app.ts`, `apps/server/tests/clients.test.ts`, `apps/server/tests/clients-sync.test.ts`, `apps/server/tests/measurements.test.ts`, `apps/server/tests/measurements-sync.test.ts`, `apps/server/tests/received-items.test.ts`, `apps/server/tests/received-items-sync.test.ts`, `apps/server/tests/received-items-anonymization.test.ts`, `apps/server/tests/materials.test.ts`, `apps/server/tests/materials-sync.test.ts`

## Overview

Todo agregado de negócio nasce pronto para o sync ([ROADMAP, premissas](../ROADMAP.md#premissas)): UUID gerado no dispositivo ([ADR 0009](../adr/0009-uuid-e-codigo-documental-por-dispositivo.md)), `version` e comandos idempotentes por `opId` que conferem a versão-base. Cada comando é definido uma única vez e chega ao servidor por dois caminhos com a mesma regra: a procedure oRPC tipada, usada pela web online, e o `sync.push`, usado pela outbox ([DEC-76](../PRD.md#96-plataforma-acesso-e-operação), [ADR 0013](../adr/0013-contrato-minimo-de-sincronizacao.md)). Cliente e perfil de usuário da peça foram os primeiros; modelo de medidas e medição seguiram o mesmo padrão ([ADR 0015](../adr/0015-medidas-em-milimetros-e-medicao-autocontida.md)), e depois a peça recebida, cujas fotos são hashes de [mídia](midia.md) no próprio payload ([ADR 0016](../adr/0016-midia-enderecada-por-conteudo.md)). O material base e a variante de material foram os primeiros com dinheiro e quantidade, e fixaram como valor inteiro atravessa as camadas ([catálogo de materiais](catalogo.md), [ADR 0017](../adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md)); são também os primeiros agregados sem dado pessoal, então `anonymized` deles é sempre `false` e nada neles é redigido. O local de estoque e o lote seguiram o mesmo molde; o movimento de estoque foi o primeiro agregado **append-only**, que só tem criação ([estoque](estoque.md), [ADR 0018](../adr/0018-movimento-append-only-com-projecao-de-saldo.md)).

## Peças de um agregado

| Peça | Onde | O que faz |
|---|---|---|
| Tabela | `packages/db/src/schema/<area>.ts` e migration gerada | Linha viva com `id` texto, `version`, `created_at` e `updated_at`; nada de apagar, erro vira arquivamento. Lista de itens que viaja inteira (campos de um modelo, valores de uma medição) cabe numa coluna JSON com `$type` |
| Store | `packages/api/src/<area>/store.ts` | `read`, `insert` e `update` com compare-and-set pela versão; toda escrita anexa o snapshot ao `change_log` com o `opId` |
| Snapshot | Mesmo store | Forma pública do agregado no `change_log` e no `sync.pull`, com datas em ISO 8601 e sem segredo nem campo derivado (como `search_text`) |
| Schemas | `packages/api/src/<area>/schemas.ts` | Payload de criação (opcionais com `.default(null)`) e patch de edição (pelo menos um campo, `hasChange` de `packages/api/src/schemas.ts`), com normalização na fronteira. Texto opcional usa `optionalText`, que aceita `null`: o conflito guarda o payload já normalizado e o `keepLocal` o valida de novo, então todo schema precisa aceitar a própria saída |
| Comandos | `packages/api/src/<area>/commands.ts` | `CreateDefinition` (`exists` e `create`) ou edições feitas por `updateCommands<Row, Patch>({ aggregateType, anonymized, read, snapshot, update })(payload, patchFor)`, com `archivePatch`, `unarchivePatch` e `definedFields` de `packages/api/src/update-command.ts`; espalhados em `syncCommands` |
| Procedures | `packages/api/src/<area>/router.ts` | `runCreateCommand` e `runUpdateCommand` com o nome do comando tipado (`CreateCommandName`, `UpdateCommandName`) e as mensagens de não encontrado e anonimizado, tiradas de `commandMessages`, que a web também importa |
| Tipo do agregado | `packages/api/src/change-log.ts` | Novo valor em `AggregateType` |
| Dados iniciais | Função `ensure<Area>` chamada no `createApp` (`apps/server/src/app.ts`) | Opcional. Cria o conteúdo inicial numa transação só quando a tabela está vazia, com snapshot no `change_log` e `opId` nulo. O boot passa a exigir a migration da tabela |

## Agregado append-only e projeção

Agregado cujo registro é um fato consumado (movimento de estoque, e depois movimento financeiro) não tem `updateCommands`, nem `updated_at`, nem `archived_at`: nasce com `version` 1, entra só em `CreateCommandName`, e uma trigger na migration recusa `UPDATE` e `DELETE`. Correção é um fato novo que referencia o antigo, e não uma edição.

Projeção derivada desse agregado (o saldo) **não** é agregado: fica fora de `AggregateType` e do `change_log`, é escrita por um único caminho na mesma transação do insert, e o dispositivo que sincroniza a recalcula a partir dos fatos que recebe no pull. O teste da área compara a soma dos fatos com a projeção, porque é essa igualdade que a projeção promete.

Recusa que precisa consultar o banco cabe no `create` de um `CreateDefinition`, que devolve `CreateRejection`; `updateCommands` não tem esse caminho. `CreateRejection` aceita `aggregateNotFound`, `aggregateAnonymized` e `aggregateExists`, e essa última é o que a procedure direta traduz em `CONFLICT` e o push grava como quarentena do mesmo nome.

## Decisão por caminho

| Situação | Procedure direta | `sync.push` |
|---|---|---|
| `opId` repetido com o mesmo conteúdo | Resultado gravado | Resultado gravado |
| `opId` repetido com outro conteúdo | `CONFLICT` `opId reutilizado com conteúdo diferente` | Quarentena `opIdReused` |
| Criação com id que já existe | `CONFLICT` `Registro já existe` | Quarentena `aggregateExists` |
| Criação com `baseVersion` diferente de `null` ou id que não é UUID | Não se aplica (a procedure recebe versão só na edição e valida o id com `z.uuid()`) | Quarentena `invalidEnvelope` |
| Pai inexistente ou agregado inexistente | `NOT_FOUND` com a mensagem do agregado; a criação pode devolver `{ reason: "aggregateNotFound", message }` quando há mais de um pai (perfil e modelo da medição) | Quarentena `aggregateNotFound` |
| Agregado anonimizado | `PRECONDITION_FAILED` | Quarentena `aggregateAnonymized` |
| Versão-base diferente | `CONFLICT` `Versão desatualizada` com `current` e `currentVersion` | Conflito aberto com valores lado a lado |
| Comando sem efeito (arquivar o que já está arquivado) | Devolve a versão atual sem escrever | Aceito com a versão atual |

A operação direta grava `aggregate_type` e `aggregate_id` na tabela `operation`, como o push; a resolução de conflito grava o agregado do conflito. É isso que permite a redação.

Quando a regra dependeria de consultar o banco para validar o payload (um campo que não pode sumir, um rótulo copiado), prefira desenhar o dado para a validação ficar só na forma: o modelo de medidas recebe só os campos ativos e o servidor desativa os ausentes; a medição copia os rótulos que o aparelho viu. Assim o push não precisa de razão de quarentena nova.

## Redação de dado pessoal

Agregado com dado pessoal entra em `personalDataAggregates` (`packages/api/src/redaction.ts`: `client`, `profile`, `measurement` e `receivedItem`) e participa da anonimização ([ADR 0014](../adr/0014-anonimizacao-redige-historico-de-sincronizacao.md)) chamando `redactHistory` na transação, depois de gravar a versão anonimizada:

| Onde o dado fica | O que a redação faz |
|---|---|
| `redacted_aggregate` | Registra tipo e id; é a lista que libera a trigger |
| `change_log` | Troca o `data` de cada linha antiga pelo snapshot anonimizado com a versão da própria linha |
| `sync_conflict` | Fecha os abertos com `keepServer` e, em todos, esvazia `local_values` e `current_values` e troca o motivo (texto livre do dono) por "Cliente anonimizado" |
| `operation` | Troca o `op_hash` por `redacted` e o `current` dos resultados de conflito pelo snapshot anonimizado |
| `audit_event` | Nada a limpar: detalhes guardam só ids e contagens |
| Operações que chegam depois | O push grava `op_hash` `redacted` quando o agregado já está em `redacted_aggregate`, quando o desfecho é `aggregateAnonymized` e em qualquer quarentena de comando cujo agregado está em `personalDataAggregates`, inclusive `invalidEnvelope`, com o comando procurado pelo nome (`commandNamed`), porque uma operação que nunca virou linha (edição de medição criada offline depois da anonimização, `unknownCommand` com tipo trocado) não é alcançada pela redação |
| Pendências | `sync.pending` não repete como `opIdReused` a operação que já está em quarentena na `operation` com hash redigido (com hash real, a repetição listada é conteúdo diferente e continua aparecendo) |
| Arquivo do banco | `secure_delete` ligado na abertura e `truncateWal` depois da anonimização, com teste que procura os valores nos bytes do `.db` e do `-wal` |

Agregado filho com dado pessoal (medições dos perfis, peças recebidas do cliente) é anonimizado na mesma transação do cliente, arquivados inclusive, e redigido com o próprio tipo. Quando o agregado referencia arquivos de mídia, a anonimização junta os hashes antes de redigir (linha viva, `change_log` e todos os conflitos), apaga as linhas de `media_file` sem outra referência dentro da transação, antes do `truncateWal`, e remove os arquivos depois do commit, com os hashes guardados numa variável do handler e nunca no resultado gravado da operação ([mídia](midia.md)). A função de anonimização recebe `mediaRoot` do contexto. Agregado novo que guarda hash de foto entra no conjunto `referencedHashes` de `packages/api/src/media/store.ts` (linha viva e conflitos abertos do próprio tipo, nos valores locais e atuais); fora dele, a coleta apaga a foto confirmada depois de 24 h.

## Testes mínimos de um agregado novo

| Arquivo | Prova |
|---|---|
| `packages/db/tests/<area>-schema.test.ts` | Colunas, chaves estrangeiras e triggers |
| `apps/server/tests/<area>.test.ts` | Criar, ler, editar, arquivar, repetição por `opId`, versão velha, id repetido, não encontrado, patch vazio e, se tiver dado pessoal, varredura depois da anonimização, com um segundo cliente intocado quando o agregado é filho |
| `apps/server/tests/<area>-sync.test.ts` | Criação e edição pelo push e pelo pull, cada razão de quarentena nova, hash das quarentenas e conflito resolvido com `keepLocal` |

A varredura de dado pessoal lê todas as tabelas de `sqlite_master` com os valores crus (`.values()`), não com `JSON.stringify` da linha, que escaparia as aspas do JSON das colunas e faria o padrão `"valueMm":\d` nunca casar. Número curto se procura por padrão com contexto, nunca pelos dígitos soltos, que aparecem em UUIDs.

Cada contrato leva uma mutação plausível com o teste que morre; o `/revisar` cobra esse desafio.

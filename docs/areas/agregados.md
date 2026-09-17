# Agregados

**Files:** `packages/api/src/sync/commands.ts`, `packages/api/src/aggregate-command.ts`, `packages/api/src/command-messages.ts`, `packages/api/src/redaction.ts`, `packages/api/src/operations.ts`, `packages/api/src/change-log.ts`, `packages/api/src/sync/push.ts`, `packages/api/src/sync/resolve.ts`, `packages/api/src/clients/`, `packages/db/src/schema/clients.ts`, `packages/db/src/migrations/0004_change_log_redaction.sql`, `apps/server/tests/clients.test.ts`, `apps/server/tests/clients-sync.test.ts`

## Overview

Todo agregado de negócio nasce pronto para o sync ([ROADMAP, premissas](../ROADMAP.md#premissas)): UUID gerado no dispositivo ([ADR 0009](../adr/0009-uuid-e-codigo-documental-por-dispositivo.md)), `version` e comandos idempotentes por `opId` que conferem a versão-base. Cada comando é definido uma única vez e chega ao servidor por dois caminhos com a mesma regra: a procedure oRPC tipada, usada pela web online, e o `sync.push`, usado pela outbox ([DEC-76](../PRD.md#96-plataforma-acesso-e-operação), [ADR 0013](../adr/0013-contrato-minimo-de-sincronizacao.md)). Cliente e perfil de usuário da peça foram os primeiros e servem de modelo.

## Peças de um agregado

| Peça | Onde | O que faz |
|---|---|---|
| Tabela | `packages/db/src/schema/<area>.ts` e migration gerada | Linha viva com `id` texto, `version`, `created_at` e `updated_at`; nada de apagar, erro vira arquivamento |
| Store | `packages/api/src/<area>/store.ts` | `read`, `insert` e `update` com compare-and-set pela versão; toda escrita anexa o snapshot ao `change_log` com o `opId` |
| Snapshot | Mesmo store | Forma pública do agregado no `change_log` e no `sync.pull`, com datas em ISO 8601 e sem segredo nem campo derivado (como `search_text`) |
| Schemas | `packages/api/src/<area>/schemas.ts` | Payload de criação (opcionais com `.default(null)`) e patch de edição (pelo menos um campo), com normalização na fronteira |
| Comandos | `packages/api/src/<area>/commands.ts` | `CreateDefinition` (`exists` e `create`) ou `UpdateDefinition` (`load` que devolve `anonymized`, `snapshot`, `values`, `version` e `apply`); espalhados em `syncCommands` |
| Procedures | `packages/api/src/<area>/router.ts` | `runCreateCommand` e `runUpdateCommand` com o nome do comando tipado (`CreateCommandName`, `UpdateCommandName`) e as mensagens de não encontrado e anonimizado, tiradas de `commandMessages`, que a web também importa |
| Tipo do agregado | `packages/api/src/change-log.ts` | Novo valor em `AggregateType` |

## Decisão por caminho

| Situação | Procedure direta | `sync.push` |
|---|---|---|
| `opId` repetido com o mesmo conteúdo | Resultado gravado | Resultado gravado |
| `opId` repetido com outro conteúdo | `CONFLICT` `opId reutilizado com conteúdo diferente` | Quarentena `opIdReused` |
| Criação com id que já existe | `CONFLICT` `Registro já existe` | Quarentena `aggregateExists` |
| Criação com `baseVersion` diferente de `null` ou id que não é UUID | Não se aplica (a procedure recebe versão só na edição e valida o id com `z.uuid()`) | Quarentena `invalidEnvelope` |
| Pai inexistente ou agregado inexistente | `NOT_FOUND` com a mensagem do agregado | Quarentena `aggregateNotFound` |
| Agregado anonimizado | `PRECONDITION_FAILED` | Quarentena `aggregateAnonymized` |
| Versão-base diferente | `CONFLICT` `Versão desatualizada` com `current` e `currentVersion` | Conflito aberto com valores lado a lado |
| Comando sem efeito (arquivar o que já está arquivado) | Devolve a versão atual sem escrever | Aceito com a versão atual |

A operação direta grava `aggregate_type` e `aggregate_id` na tabela `operation`, como o push; a resolução de conflito grava o agregado do conflito. É isso que permite a redação.

## Redação de dado pessoal

Agregado com dado pessoal participa da anonimização ([ADR 0014](../adr/0014-anonimizacao-redige-historico-de-sincronizacao.md)) chamando `redactHistory` de `packages/api/src/redaction.ts` na transação, depois de gravar a versão anonimizada:

| Onde o dado fica | O que a redação faz |
|---|---|
| `redacted_aggregate` | Registra tipo e id; é a lista que libera a trigger |
| `change_log` | Troca o `data` de cada linha antiga pelo snapshot anonimizado com a versão da própria linha |
| `sync_conflict` | Fecha os abertos com `keepServer` e, em todos, esvazia `local_values` e `current_values` e troca o motivo (texto livre do dono) por "Cliente anonimizado" |
| `operation` | Troca o `op_hash` por `redacted` e o `current` dos resultados de conflito pelo snapshot anonimizado |
| `audit_event` | Nada a limpar: detalhes guardam só ids e contagens |
| Operações que chegam depois | O push grava `op_hash` `redacted` quando o agregado já está em `redacted_aggregate`, quando o desfecho é `aggregateAnonymized` e quando uma criação cai em `aggregateNotFound` por pai inexistente |
| Arquivo do banco | `secure_delete` ligado na abertura e `truncateWal` depois da anonimização, com teste que procura os valores nos bytes do `.db` e do `-wal` |

## Testes mínimos de um agregado novo

| Arquivo | Prova |
|---|---|
| `packages/db/tests/<area>-schema.test.ts` | Colunas, chaves estrangeiras e triggers |
| `apps/server/tests/<area>.test.ts` | Criar, ler, editar, arquivar, repetição por `opId`, versão velha, id repetido, não encontrado e, se tiver dado pessoal, varredura das tabelas depois da anonimização |
| `apps/server/tests/<area>-sync.test.ts` | Criação e edição pelo push e pelo pull, cada razão de quarentena nova, conflito resolvido com `keepLocal` |

Cada contrato leva uma mutação plausível com o teste que morre; o `/revisar` cobra esse desafio.

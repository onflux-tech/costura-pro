---
paths:
  - "packages/db/**"
---

# Banco (`packages/db`)

- Antes de mexer no adapter, leia o [ADR 0006](../../docs/adr/0006-sqlite-nativo-bun.md).
- Schema muda só por migration: `pnpm db:generate`, revisão do SQL e `pnpm db:migrate` contra banco temporário. `db:push` só em banco descartável (o guard bloqueia).
- `DATABASE_FILE` é caminho absoluto local; teste de integração usa diretório temporário e SQLite real.
- Movimentos e documentos emitidos são append-only; projeção de saldo muda na mesma transação ([SPEC §2](../../docs/SPEC.md#2-persistência-valores-e-fronteiras-de-domínio)).
- A partir da F3, todo agregado nasce com UUID, `version` e comando idempotente por `opId`.

## Armadilhas conhecidas

- Feche a conexão sempre por `closeDb`: `close()` do `bun:sqlite` adia o fechamento com statements do Drizzle abertos e, no Windows, deixa o arquivo travado.
- `drizzle-kit migrate` não suporta `bun:sqlite`; o executor é `pnpm db:migrate`.
- Caminho UNC é rejeitado de propósito: WAL em compartilhamento de rede corrompe.
- No Drizzle sobre `bun:sqlite`, `.run()` é tipado como `void` embora devolva `changes`: compare-and-set confere o efeito com `.returning(...).all()`, e transação é síncrona (sem `await` dentro do callback).
- Trigger e SQL que o drizzle-kit não gera vão numa migration `--custom` (`pnpm --filter @costura-pro/db exec drizzle-kit generate --custom --name <nome>`). Renomear migration ainda não publicada exige trocar a `tag` em `src/migrations/meta/_journal.json`.
- Nome de migration descreve o conteúdo, nunca a fase (`0001_installation_access_sync`).
- Subconsulta correlacionada dentro de `sql` no `select` do Drizzle renderiza as colunas sem a tabela (`"client_id" = "id"`), e o `id` passa a ser o da própria subconsulta: a contagem volta 0 sem erro. Use alias e colunas qualificadas em SQL literal e confira o texto com `.toSQL()`.
- `change_log` é append-only com uma única exceção: UPDATE só de `data` para agregado registrado em `redacted_aggregate` (trigger `change_log_update_only_redaction`). Qualquer outra escrita precisa continuar recusada, e mudança na trigger vem com o teste de `packages/db/tests/clients-schema.test.ts` ([ADR 0014](../../docs/adr/0014-anonimizacao-redige-historico-de-sincronizacao.md)).
- Lista que viaja inteira com o agregado (campos de modelo, valores de medição) é coluna `text` com `mode: "json"` e `$type<...>()`; varredura de dado pessoal nessas colunas lê os valores crus (`.values()`), porque `JSON.stringify` da linha escapa as aspas e o padrão `"valueMm":\d` nunca casa.
- `createDb` liga `PRAGMA secure_delete = ON` e a anonimização chama `truncateWal`: sem os dois, o valor antigo continua nos bytes livres do arquivo e no `-wal`, invisível para SQL. O teste de `apps/server/tests/clients.test.ts` procura os valores nos bytes; não remova nenhum dos dois.
- No Drizzle sobre `bun:sqlite`, `db.all(sql)` devolve objetos por coluna e `db.get(sql)` devolve um array de valores; compare a forma antes de ler o resultado.
- `json_each` sobre coluna JSON ou caminho ausente devolve zero linhas, sem erro: consulta que junta hashes de `photos` e de valores de conflito não precisa de guarda para `NULL`.
- Dinheiro e quantidade usam a coluna `integer` do `bigintInteger` (`packages/db/src/columns.ts`), nunca `integer({ mode: "number" })` nem `text`: o tipo próprio devolve `bigint`, recusa acima de 2^53 - 1 na gravação e mantém `SUM`, comparação, `ORDER BY` e índice funcionando em SQL ([ADR 0017](../../docs/adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md)). Coluna de valor nova entra no mesmo padrão e com teste de ida e volta.
- Lista de valores duplicada do domínio (como `baseUnitValues` contra `baseUnitCodes`) não tem guarda dentro do `packages/db`, que não depende do domínio: a igualdade é provada num teste do servidor, que enxerga os dois pacotes.
- `NOT IN (subconsulta)` com algum `NULL` no conjunto não devolve linha nenhuma: filtre `IS NOT NULL` dentro da subconsulta (`listUnreferencedMediaFilesUploadedBefore`).

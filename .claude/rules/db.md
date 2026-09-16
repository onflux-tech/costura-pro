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

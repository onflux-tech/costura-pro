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

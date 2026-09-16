---
status: accepted
date: 2026-09-15
---

# SQLite nativo do Bun como fonte autoritativa

A base autoritativa é um arquivo SQLite local em WAL, aberto por Drizzle sobre `bun:sqlite` num único processo servidor que controla as gravações. O scaffold do Better-T-Stack gerou libSQL (cliente orientado a Turso e banco remoto), que foi trocado antes de qualquer migration operacional: um ateliê com um PC não precisa de servidor de banco, e o backup consistente depende de `VACUUM INTO` no mesmo driver.

## Opções consideradas

- **libSQL/Turso gerado pelo scaffold:** dependência extra e modelo remoto sem ganho para um único PC.
- **`node:sqlite` dentro do Bun:** marcado como não implementado no Bun na data da decisão.

## Consequências

- `DATABASE_FILE` precisa ser caminho absoluto local; URL remota, `:memory:`, caminho relativo e caminho UNC de rede são rejeitados, porque WAL em compartilhamento de rede corrompe.
- `drizzle-kit` só gera SQL; migrations rodam por um executor Bun com `drizzle-orm/bun-sqlite/migrator`, já que `drizzle-kit migrate` não suporta `bun:sqlite`.
- `db:push` nunca roda contra banco com dados reais.
- Uma conexão por processo, nunca por request.

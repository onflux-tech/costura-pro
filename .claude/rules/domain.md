---
paths:
  - "packages/domain/**"
---

# Domínio (`packages/domain`)

- Funções puras: sem I/O, banco, data atual ou aleatoriedade; tudo chega por parâmetro.
- Dinheiro em centavos `bigint` e quantidade em milionésimos da unidade base `bigint`; `number` nunca representa valor ([ADR 0010](../../docs/adr/0010-dinheiro-e-quantidade-inteiros.md)).
- Arredondamento ao centavo, meio para cima, com resíduo de rateio na última linha ([SPEC §2](../../docs/SPEC.md#2-persistência-valores-e-fronteiras-de-domínio)).
- TDD com `bun test` e arquivo `*.test.ts` ao lado do código, cobrindo fronteira e entrada inválida.
- Nomes seguem o `CONTEXT.md`; termo novo entra lá na mesma mudança.

## Armadilhas conhecidas

- Margem é sobre a venda, não markup: custo R$ 60 com meta de 40% sugere R$ 100.
- Reserva nunca inventa saldo: falta vira pendência de abastecimento.
- `pnpm fix` ordena as chaves de objeto literal: teste que depende da ordem de chaves monta o objeto com `JSON.parse`.

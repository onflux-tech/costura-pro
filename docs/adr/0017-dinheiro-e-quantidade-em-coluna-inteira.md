---
status: accepted
date: 2026-09-17
---

# Dinheiro e quantidade em coluna inteira do SQLite e inteiro em string no JSON

A [ADR 0010](0010-dinheiro-e-quantidade-inteiros.md) fixou centavos e milionésimos como `bigint` no domínio, sem dizer como eles chegam ao disco nem como viajam. A partir do catálogo de materiais, cada valor mora numa coluna `integer` do SQLite mapeada por um `customType` do Drizzle (`packages/db/src/columns.ts`), que devolve `bigint` no TypeScript e recusa, na gravação, qualquer valor acima de 2^53 - 1. No JSON de payload, snapshot e `sync.pull` o valor é o inteiro escrito em base 10 dentro de uma string (`"1250"` centavos, `"1500000"` milionésimos), nunca `number`, nunca `bigint` e nunca decimal humano.

## Opções consideradas

- **Coluna `text` com o inteiro em string:** exata sem teto, mas toda soma, comparação e ordenação em SQL passa a exigir `CAST`, índice de texto não ordena por valor, e quem esquecer o `CAST` compara `"1000"` com `"9"` e recebe a resposta errada em silêncio. Saldo por local, disponibilidade e lista de compras dependem justamente dessas operações.
- **Coluna `blob` no modo `bigint` do Drizzle:** exata e pronta, mas comparação de blob é byte a byte, então nenhuma agregação funciona em SQL e todo saldo teria de ser somado em memória.
- **Decimal humano em string no JSON (`"12.50"`, `"1.5"`):** legível no log, mas servidor, PWA e teste passariam a precisar da precisão exibida da variante para interpretar o número, e um valor com precisão errada arredondaria em silêncio.
- **`bigint` direto no payload:** o `sync_conflict` grava o payload já parseado como JSON, e `JSON.stringify` de `bigint` lança; um conflito de edição derrubaria o `sync.push` inteiro.

## Consequências

- `SUM`, comparação, `ORDER BY` e índice funcionam direto em SQL sobre dinheiro e quantidade.
- O teto exato é 9.007.199.254.740.991, validado duas vezes: no schema do payload (`moneyCentsSchema` e `quantityMicrosSchema` em `packages/api/src/schemas.ts`) e no `toDriver` da coluna, que lança `RangeError`. São 90 trilhões de reais em centavos e 9 bilhões de unidades base em milionésimos.
- O schema de payload aceita só dígitos e canonicaliza por `BigInt(valor).toString()`, então `"0012"` grava como `"12"` e a repetição por `opId` compara o mesmo hash.
- A conversão para `bigint` acontece só no store, e o snapshot converte de volta para string; nenhuma camada acima do store manipula `bigint`.
- A precisão exibida da variante não participa da gravação: o servidor aceita qualquer quantidade dentro do teto, e a tela é que restringe o que o dono digita e formata o que ele vê.
- Coluna de valor nova segue este padrão; usar `integer({ mode: "number" })` para dinheiro ou quantidade fica proibido pela rule de banco.

---
paths:
  - "packages/domain/**"
---

# Domínio (`packages/domain`)

- Funções puras: sem I/O, banco, data atual ou aleatoriedade; tudo chega por parâmetro.
- Dinheiro em centavos `bigint` e quantidade em milionésimos da unidade base `bigint`; `number` nunca representa valor ([ADR 0010](../../docs/adr/0010-dinheiro-e-quantidade-inteiros.md)).
- Medida de corpo é a exceção: inteiro de milímetros de 1 a 9999 como `number`, convertido de e para centímetros só por `parseCentimeters` e `formatCentimeters` ([ADR 0015](../../docs/adr/0015-medidas-em-milimetros-e-medicao-autocontida.md)).
- Quantidade de peças recebidas também é exceção: contagem inteira de 1 a 999 como `number` (`receivedItemLimits`), porque não é estoque nem entra em cálculo.
- Contagens do orçamento também são `number`: quantidade da linha de serviço, peça sob medida e linha livre (1 a 9999), `count` do componente de serviço (1 a 99), pontos-base do desconto percentual (1 a 10000) e dias de validade e prazo (1 a 365), sempre por `quoteLimits`. Viram `bigint` só dentro da conta (`BigInt(quantity) * preço`); a quantidade do material continua em milionésimos `bigint`.
- Arredondamento ao centavo, meio para cima; no rateio, cada linha recebe a parte arredondada para baixo e a última linha com peso fica com o resto (`allocateProportionally`), o que conserva o total, nunca dá parte negativa e não dá custo a brinde ([SPEC §2](../../docs/SPEC.md#2-persistência-valores-e-fronteiras-de-domínio)).
- TDD com `bun test` e arquivo `*.test.ts` ao lado do código, cobrindo fronteira e entrada inválida.
- Nomes seguem o `CONTEXT.md`; termo novo entra lá na mesma mudança.

## Armadilhas conhecidas

- Margem é sobre a venda, não markup: custo R$ 60 com meta de 40% sugere R$ 100.
- Reserva nunca inventa saldo: falta vira pendência de abastecimento.
- `pnpm fix` ordena as chaves de objeto literal: teste que depende da ordem de chaves monta o objeto com `JSON.parse`.
- `parseQuantity` recusa mais casas que a precisão recebida e `formatQuantity` nunca arredonda. Precisão exibida é só exibição: o formulário valida contra o máximo (6 casas) e não contra a precisão da variante, senão baixar a precisão travaria a edição de um valor já gravado.
- `pnpm fix` ordena as chaves de objeto literal, então lista com ordem significativa (unidades base) nasce de uma tupla `as const` e o `Record` só guarda os detalhes.
- Conta de valor usada pelo servidor e pela prévia da tela mora no domínio e é chamada pelos dois (`purchaseTotals`): a tela nunca refaz a conta por conta própria, senão a prévia e o gravado divergem no centavo.
- Estado derivado de fatos (obrigação aberta, paga ou cancelada) tem a precedência numa função pura (`obligationStatus`), e a consulta SQL reproduz a mesma ordem; teste as combinações conflitantes (paga e estornada).
- Módulo novo do domínio precisa da própria entrada no `exports` do `packages/domain/package.json` (`types` no `dist`, `default` no `src`): sem ela, `@costura-pro/domain/<modulo>` não resolve no servidor nem na web.
- Normalização de texto e palavras de busca moram em `packages/domain/src/search.ts` (`normalizeText`, `searchTokens`, `matchesAll`, `matchedVariants`, `highlightRanges`), a mesma regra do `search_text` das listas e da busca offline; não recrie a normalização noutro módulo ([busca](../../docs/areas/busca.md)).
- Posição achada no texto normalizado não vale no original: acento decomposto (NFD) some na normalização e muda o tamanho do texto. `highlightRanges` guarda, para cada unidade normalizada, o início e o fim do caractere original, e o teste tem o caso em NFD, porque em NFC as posições coincidem e a mutação sobrevive.

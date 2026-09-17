---
status: accepted
date: 2026-09-17
---

# Medidas em milímetros inteiros e medição autocontida

Cada medida é guardada como inteiro de milímetros (`valueMm`, de 1 a 9999), digitada e exibida em centímetros com no máximo uma casa decimal ("74,5" vira 745). Uma medição é um registro datado de um perfil que copia o nome, a versão e os rótulos do modelo de medidas usado e guarda os valores por `fieldId`; o aparelho compõe a medição a partir do modelo que ele vê, e o servidor valida só a forma e a existência do perfil e do modelo. Complementa a [ADR 0010](0010-dinheiro-e-quantidade-inteiros.md), que trata dinheiro e quantidade de estoque, e a [ADR 0014](0014-anonimizacao-redige-historico-de-sincronizacao.md), que passa a alcançar as medições.

## Opções consideradas

- **Meio centímetro inteiro:** impede ajuste fino de 0,3 cm, e trocar a unidade depois exigiria migrar todos os valores.
- **Milionésimos de centímetro em `bigint`, como a quantidade de estoque:** consistente com o estoque, mas com precisão que a fita métrica não tem e string decimal em todo payload.
- **Décimos de milímetro:** mais dígitos sem ganho real, porque a menor marca da fita é o milímetro.
- **Servidor copiando os rótulos do modelo atual na chegada:** um aparelho offline que mediu com a versão 3 enquanto o PC salvou a versão 4 teria os rótulos trocados ou os valores recusados.
- **Tabela de versões do modelo com a medição apontando a versão:** fonte única dos rótulos, mas mais uma tabela, e o congelamento da medição na OS (F4) dependeria de duas leituras.

## Consequências

- Medida é `number` inteiro no domínio e no JSON, e não `bigint` com string decimal: não é dinheiro nem quantidade de estoque, e 9999 cabe folgado.
- Campo de modelo nunca é apagado, só desativado: a edição envia só os campos ativos e o servidor guarda os ausentes como desativados, então o `fieldId` de uma medição antiga continua existindo no modelo.
- A medição não precisa do modelo para ser lida, e o snapshot de medidas do subitem da OS (F4) é a cópia de uma medição.
- Duas medições criadas offline em aparelhos diferentes nunca conflitam; só a correção da mesma medição compara versão-base.
- Rótulos e versão enviados pelo aparelho são confiados como o nome de um cliente: vêm dos aparelhos do próprio dono.
- Anonimizar o cliente zera valores e notas de todas as medições dos perfis e redige o histórico delas; rótulos, modelo e data ficam.

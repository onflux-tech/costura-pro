---
status: accepted
date: 2026-09-15
---

# Dinheiro em centavos e quantidade em milionésimos, sempre inteiros

Valores monetários são inteiros de centavos com sinal e quantidades são inteiros de milionésimos da unidade base, ambos `bigint` no domínio e string decimal no JSON. Rateio de frete, conversão de embalagem, perda percentual e custo médio acumulam erro com ponto flutuante, e o mesmo cálculo roda no servidor e na PWA offline, então precisa dar o mesmo resultado nos dois lados.

## Opções consideradas

- **`number` de ponto flutuante:** erro de arredondamento em centavos e divergência entre ambientes.
- **Decimal em string com biblioteca:** dependência a mais em domínio, API e cliente para o que inteiros resolvem.
- **Quantidade com menos casas fixas:** não cobre a precisão de até 6 casas que cada variante pode declarar.

## Consequências

- Arredondamento monetário ao centavo, meio para cima; resíduo de rateio fica na última linha ou lote para conservar o total.
- Preço sugerido arredonda para cima para não ficar abaixo da margem desejada.
- Cada variante declara a precisão exibida, de 0 a 6 casas; a conversão de compra usa fator racional positivo.
- JSON nunca carrega esses valores como `number`.

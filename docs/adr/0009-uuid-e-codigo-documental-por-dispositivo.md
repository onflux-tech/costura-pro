---
status: accepted
date: 2026-09-15
---

# Identidade UUID e código documental não sequencial por dispositivo

Cada registro nasce com UUIDv4 gerado no próprio dispositivo, e documentos e ordens recebem um código humano permanente formado por tipo, ano, sigla do dispositivo e contador local (`ORC-2026-CEL-0042`). Dois aparelhos offline precisam criar orçamentos ao mesmo tempo sem colisão, e o código impresso num documento entregue ao cliente não pode mudar depois do sync.

## Opções consideradas

- **Número provisório trocado por sequência global no sync:** o código impresso offline ficaria errado.
- **Blocos de números reservados por dispositivo:** exige reposição antes de esgotar e falha num aparelho offline por muito tempo.
- **Sequência global única:** impossível sem servidor alcançável.

## Consequências

- Códigos não são contíguos; lacunas não indicam documento apagado.
- A sigla de dispositivo é única dentro da instalação.
- Código documental nunca é chave primária nem referência entre tabelas.

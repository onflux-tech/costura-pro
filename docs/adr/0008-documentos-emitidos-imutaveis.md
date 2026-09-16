---
status: accepted
date: 2026-09-15
---

# Documentos emitidos são imutáveis, inclusive quando emitidos offline

Ao emitir orçamento, comprovante ou recibo, o sistema congela os dados, os bytes do PDF, o template e as fontes versionados e o hash SHA-256. Um documento entregue ao cliente precisa continuar idêntico mesmo que logo, preço ou template mudem depois. Como a PWA emite documentos finais sem internet, templates e fontes viajam versionados com o app e o PDF emitido entra no cofre e na outbox.

## Opções consideradas

- **Congelar só os dados e regenerar o PDF:** a aparência de documentos antigos mudaria com o template novo.
- **Documento dinâmico:** não preserva o que foi entregue ao cliente.
- **Emitir documento final só no servidor:** sacrificaria o uso móvel offline pedido pelo dono.

## Consequências

- Nova informação exige revisão ou estorno que referencia a emissão anterior.
- O servidor nunca regenera um documento antigo com template novo.
- Todo documento traz o aviso "documento não fiscal"; custos internos nunca aparecem ao cliente.
- A biblioteca de PDF precisa funcionar igual no navegador móvel e no desktop (spike no ROADMAP).

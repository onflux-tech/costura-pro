---
status: accepted
date: 2026-09-24
---

# Orçamento como rascunho mutável e cada emissão como revisão congelada

O RF-COM-04 pede revisão numerada e aceite parcial, e o DEC-30 diz que o vencido renova por revisão. O [ADR 0008](0008-documentos-emitidos-imutaveis.md) já fixava que documento emitido não muda, e a compra e a sessão de inventário já eram fatos imutáveis com linhas em JSON ([ADR 0019](0019-compra-e-obrigacao-como-fatos-imutaveis.md), [ADR 0022](0022-sessao-de-inventario-como-fato-com-esperado-da-contagem.md)). Antes do schema era preciso decidir onde mora o que o dono ainda edita, o que a emissão congela e como a anonimização alcança um documento que não pode mudar.

**Onde mora a edição.** O orçamento (`quote`) é o rascunho: um agregado comum, sempre editável pelo `updateCommands`, com as linhas, o desconto, a validade em dias, o prazo proposto e as observações. A edição troca o conteúdo inteiro de uma vez, validado junto, porque o limite do desconto do orçamento depende das linhas e a edição não tem caminho de recusa. O código documental (`ORC-<ano>-PC-<número>`) nasce na criação do rascunho, pelo servidor, com o ano da data do orçamento.

**O que a emissão congela.** Cada emissão grava uma revisão (`quote_revision`), agregado próprio criado de uma vez por `quote.emit`, com o número seguinte do orçamento, o conteúdo que a tela mandou, os totais calculados por linha e do orçamento, o custo, a meta do ateliê do momento, a data da emissão e o "válido até" (data da emissão mais a validade). A revisão nunca muda: triggers recusam `UPDATE` e `DELETE`. O estado do orçamento é derivado, nunca gravado: recusado, rascunho sem revisão, vencido quando o "válido até" da última revisão passou do dia de hoje da tela, emitido nos demais casos. Emitir nova revisão limpa a recusa do rascunho na mesma transação.

**Como a anonimização chega à revisão.** Anonimizar o cliente limpa os textos livres dos orçamentos dele (observações, motivos, notas de linha, descrição de peça e de linha livre, que viram "Item anonimizado") no rascunho e em cada revisão, e redige o histórico dos dois tipos ([ADR 0014](0014-anonimizacao-redige-historico-de-sincronizacao.md)). A trigger da revisão libera só a troca de `content` e `reason`, com a versão subindo exatamente uma vez, e só quando a revisão está em `redacted_aggregate`; a versão nova entra no `change_log`, e o aparelho que já tinha puxado a revisão recebe a versão redigida no próximo pull. Valores, datas, código, números e nomes copiados do catálogo ficam.

## Opções consideradas

- **Revisões numa lista JSON dentro do orçamento:** uma tabela só, mas a trigger não protegeria uma revisão sem travar o rascunho, e a busca e a lista leriam o JSON para achar a última revisão.
- **Cada revisão como agregado mutável que trava na emissão:** o rascunho seria a própria revisão aberta, mas travar exigiria caminho de recusa no `updateCommands`, e a revisão emitida seguiria mutável no banco até a trava.
- **Código só na emissão:** o rascunho ficaria sem identificador para a busca e para a conversa com o cliente.
- **Patch parcial por campo:** tirar uma linha podia deixar o desconto do orçamento acima do subtotal sem nenhuma recusa possível.
- **Recusar a anonimização com orçamento aberto, ou não mexer nos orçamentos:** a primeira prende o pedido do titular a um documento comercial; a segunda deixa texto pessoal em fato imutável.

## Consequências

- A emissão não confere a versão do rascunho: congela o que a tela mostrou. Se outra janela mudou o rascunho, a página avisa "Alterações não emitidas" e o dono emite de novo ou descarta.
- Aceite parcial é uma revisão nova sem os itens recusados; a aprovação, a OS, as reservas e o PDF da revisão ficam para a entrega seguinte e partem da revisão congelada.
- A revisão guarda custo e meta do momento: a margem de uma revisão antiga não muda quando o custo de catálogo ou a meta do ateliê mudam.
- Na F6, o aparelho offline gera o código com a própria sigla no lugar de `PC`, e a numeração da revisão segue por orçamento.

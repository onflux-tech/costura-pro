---
status: accepted
date: 2026-09-23
---

# Ficha técnica no produto base, ajustes por item na variante e custo estimado na leitura

O produto base representa roupas, kits e outros acabados, e cada variante tem código, preço e, na F5, estoque próprio (RF-CAT-06, RF-CAT-07). A ficha técnica lista materiais, perdas normais e serviços, e a variante sobrescreve só as diferenças (RF-CAT-08); a mesma ficha vai sugerir componentes ao orçamento e à OP (RF-CAT-09). Antes do schema era preciso decidir onde a ficha mora, para o que o item aponta, como a variante ajusta e de onde sai o custo estimado.

**Onde a ficha mora.** A ficha é uma lista JSON no próprio produto base, como os campos da medição e os itens da compra. A versão do produto é a versão da ficha: orçamento e OP copiam os itens na hora em que nascem, como o orçamento copia o serviço ([ADR 0020](0020-servico-versionado-e-preco-sugerido-na-leitura.md)), e mudar a ficha depois nunca reescreve um trabalho já criado.

**Para o que o item aponta.** O item de material aponta sempre para uma variante de material, que dá unidade, custo de referência e, na F4, saldo sem ambiguidade; a cor ou o tamanho de uma variante do produto troca a variante do material pelo ajuste. O serviço entra com quantidade inteira. Cada item tem id gerado no aparelho, estável entre edições, e observação curta opcional.

**Como a variante ajusta.** A variante guarda uma lista de ajustes: trocar um item da base inteiro (mesmo id), tirar um item da base ou acrescentar um item, no máximo um ajuste por item da base. A ficha efetiva da variante é a base na ordem, com as trocas no lugar, sem os tirados e com os acrescentados no fim; ajuste de um item que saiu da base é ignorado. Mudar um item na base vale para todas as variantes que não o trocaram.

**Custo estimado.** A perda normal é por item de material, fixa (na unidade do item) ou percentual; a quantidade planejada é a quantidade mais a perda, arredondada para cima ao milionésimo. O custo do material é a quantidade planejada vezes o custo de referência da variante, meio para cima ao centavo, e o do serviço é a quantidade vezes o custo atual dele. Nada disso é gravado: a tela calcula com uma única função do domínio (`sheetCost` e `effectiveSheet` em `packages/domain/src/product.ts`) sobre as referências que o servidor devolve, e o preço sugerido sai de `pricingOf` com a meta própria do produto ou a do ateliê. Faltando o custo de algum material, não há sugestão, margem nem aviso, só a lista do que falta. Ficha efetiva vazia também não tem custo estimado: a soma de nenhum item não é custo zero, e mostrar sugestão de R$ 0,00 com margem de 100% enganaria o dono.

## Opções consideradas

- **Ficha como agregado próprio:** versão separada da descrição do produto, mas um agregado inteiro a mais (comandos, snapshot, sync) sem ganho para um dono único.
- **Item apontando para o material base ou a variante:** permitiria "tecido de qualquer cor", mas as variantes de um material podem ter unidades diferentes, e o custo e a reserva precisariam de uma regra para escolher a variante.
- **Cópia inteira da ficha na variante:** simples, mas mudança na base não chegaria às variantes que copiaram, e isso some da vista.
- **Custo pelo médio do estoque:** segue as compras reais, mas oscila com ajustes, some com o saldo zerado e muda a sugestão sem o dono mexer em nada.
- **Conferir no servidor que as referências existem:** caberia na criação, mas não na edição sem caminho de rejeição no `updateCommands`; como material e serviço nunca são apagados, a leitura trata id desconhecido como item sem custo.

## Consequências

- Editar o nome do produto e a ficha em dois aparelhos sem sincronizar vira um conflito só, resolvido pela caixa de conflitos como qualquer outro.
- A capa da variante aponta para uma foto da galeria pelo hash; tirar a foto da galeria tira a capa, e a variante volta à imagem principal. Só as fotos da galeria entram no conjunto de hashes referenciados da mídia.
- Orçamento e OP da F4 e F5 copiam a ficha efetiva da variante (ou a da base, no orçamento sob medida) com a quantidade planejada, e a reserva parte dela.
- Custo de referência sem valor deixa o produto sem preço sugerido até o dono informar o custo da variante do material.

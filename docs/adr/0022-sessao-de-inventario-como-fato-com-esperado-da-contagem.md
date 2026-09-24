---
status: accepted
date: 2026-09-23
---

# Sessão de inventário como fato gravado na finalização, com o esperado da hora da contagem

O RF-EST-13 pede a sessão de inventário: contagem física em lote, com prévia das divergências, que gera ajustes auditados ao finalizar. O movimento de estoque já era append-only com projeção de saldo ([ADR 0018](0018-movimento-append-only-com-projecao-de-saldo.md)), e a compra já era um fato imutável com as linhas em JSON e os ids dos movimentos no payload ([ADR 0019](0019-compra-e-obrigacao-como-fatos-imutaveis.md)). Antes do schema era preciso decidir onde mora a contagem em andamento, qual saldo esperado mede a diferença e como o ajuste aparece no histórico.

**Onde mora a contagem.** A sessão de inventário (`inventory_session`) é um fato append-only criado de uma vez, na finalização, por `inventorySession.create`: guarda a data, o motivo, as notas e as linhas contadas (ponto, esperado, contado, id do movimento e valor), inclusive as que bateram. Enquanto o dono conta, o rascunho vive no aparelho (`localStorage`), sobrevive a recarregar e a fechar a aba e acompanha outras abas do mesmo navegador, mas não passa para outro aparelho.

**Qual esperado vale.** O esperado de cada linha é o saldo do ponto na hora em que o dono digitou a contagem, capturado pela tela. O movimento é a diferença entre o contado e esse esperado, somada ao saldo que o ponto tiver na finalização, e o servidor não compara o esperado com o saldo atual: a diferença observada é o fato. Assim, uma compra lançada depois da contagem de uma prateleira continua no saldo, e o que já estava na prateleira quando ela foi contada não é somado duas vezes.

**Como o ajuste aparece.** Cada linha divergente vira um movimento do tipo `inventory`, com `inventory_session_id` apontando para a sessão e o motivo dela. A falta sai pela média do ponto na finalização, como o ajuste negativo; a sobra entra pelo valor informado, que a revisão preenche com a média do ponto (quando ele tem saldo positivo) ou com o custo de referência da variante. O movimento se estorna um a um, como o ajuste, e a sessão continua registrada, marcando a linha estornada.

## Opções consideradas

- **Rascunho no servidor, como agregado mutável com fechamento:** retomaria a contagem em qualquer aparelho, mas cada contagem salva seria uma versão nova, dois aparelhos na mesma sessão dariam conflito, e o fechamento precisaria de um caminho de recusa que o `updateCommands` não tem.
- **Só um lote de ajustes, sem registro da sessão:** o mais simples, mas o que bateu (contado igual ao esperado) e o esperado de cada linha não ficariam em lugar nenhum.
- **Esperado do fechamento:** o ajuste levaria o ponto ao contado, apagando o que entrou ou saiu entre a contagem e a finalização.
- **Esperado da abertura da sessão:** o que entrou depois da abertura e já estava na prateleira quando ela foi contada seria somado duas vezes.
- **Reusar o tipo `adjustment`:** o inventário só se distinguiria do ajuste rápido pelo link, e o histórico perderia a leitura imediata.

## Consequências

- Um comando só grava a sessão e todos os movimentos numa transação, com recusa nos dois caminhos: ponto inválido por `checkPlace` (`aggregateNotFound`) e id de movimento igual ao da sessão ou já usado (`aggregateExists`).
- A contagem em andamento se perde se o dono limpar os dados do navegador, e não segue para outro aparelho; no aparelho sem armazenamento a tela avisa e guarda na memória da página.
- Na F6, a contagem feita offline leva o esperado que o aparelho conhecia; dois aparelhos contando o mesmo ponto sem sincronizar somam os dois ajustes, e cabe à revisão, que mostra quando o saldo mudou depois da contagem, avisar o dono.
- Ponto não contado fica como está: nada muda sem uma contagem explícita, e a revisão lista os não contados com "Contar como zero".

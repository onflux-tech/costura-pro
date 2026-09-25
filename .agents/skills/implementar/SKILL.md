---
name: implementar
description: Executa o plano aprovado de uma entrega do Costura Pro despachando o papel implementer, um checkpoint por vez, e conferindo cada um. Use depois do plano do /entrega-iniciar, na sessão que o dono escolheu (a mesma do design ou uma nova, aberta pelo handoff), ou quando o dono pedir para executar um plano.
---

# Implementar

O agente principal coordena e confere; o `implementer` escreve o código e os testes de cada checkpoint. Cada passo termina num critério de pronto; só avance com ele cumprido.

1. **Preparação.** Confirme a branch da entrega (`git branch --show-current`) e leia do plano só o cabeçalho, as Global Constraints, o Review Focus, o mapa de arquivos e a tabela de checkpoints; as tarefas são lidas pelos implementers. Pronto com a lista de checkpoints no chat e o primeiro sem `- [x]` identificado.
2. **Despacho.** Um `implementer` por vez, com:
   - uma linha de onde o checkpoint fica na entrega;
   - o caminho do plano e "leia só as seções das tarefas N a M e as Global Constraints";
   - as interfaces e decisões de checkpoints anteriores que o plano não traz, e a sua resolução para as ambiguidades que perceber;
   - o scratchpad desta sessão para logs e o caminho do relatório, `<scratchpad>/checkpoint-<n>.md`.

   O despacho descreve só o checkpoint; o histórico dos anteriores fica nos relatórios deles. Antes de despachar, tire a foto da árvore sem tocar o índice (`GIT_INDEX_FILE=<scratchpad>/foto.index git add -A` e, com o mesmo `GIT_INDEX_FILE`, `git write-tree`) e anote no plano, ao lado do checkpoint, o id que o `write-tree` imprime, para ele sobreviver a uma compactação; o mesmo arquivo de índice serve para todas as fotos. Pronto com o implementer despachado.
3. **Conferência.** Com `DONE`:
   - `git diff --stat <foto de antes> <foto de agora>`, com a foto nova tirada do mesmo jeito, bate com o mapa de arquivos do checkpoint; o diff da árvore acumula os checkpoints anteriores e não serve para isso;
   - o relatório mostra, por Grep, cada comportamento visto vermelho e depois verde;
   - checkpoint de tela traz as capturas de 320 px e do desktop, e você abre ao menos uma de cada;
   - ao fechar uma camada (domínio, banco, API, web), `pnpm check-types` uma vez, com saída em arquivo.

   Pronto com o checkpoint marcado `- [x]` no plano e o status anotado ao lado.
4. **Desvios.**
   - `NEEDS_CONTEXT`: responda ao mesmo implementer por mensagem; o que depende do dono passa antes pelo `AskUserQuestion`.
   - `BLOCKED`: dê mais contexto, divida o checkpoint ou corrija o plano e anote a correção nele.
   - `DONE_WITH_CONCERNS`: decida e anote no plano antes do próximo checkpoint.

   Código se corrige pelo implementer; você edita só o plano. Pronto quando o checkpoint voltar a `DONE`.
5. **Retomada.** Depois de compactação ou de sessão interrompida, o plano marcado e o `git status` dizem onde parar: o que está marcado fica como está, e o primeiro checkpoint sem marca passa pelo passo 3, com a foto anotada no plano, antes de ser redespachado.
6. **Fim.** Com todos os checkpoints marcados, rode `/entrega-fechar`. Falha da bateria do `/verificar` e achados do `/revisar` vão ao implementer num único despacho por rodada, com a lista inteira, os logs e o teste que cada correção precisa, e com a foto da árvore do passo 2 tirada antes, para a nova revisão ler só o diff da rodada; falha da bateria passa antes pelo `superpowers:systematic-debugging`, para o despacho levar a causa e não o sintoma. Pronto com o `/entrega-fechar` em andamento.

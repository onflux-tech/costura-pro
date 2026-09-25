---
name: implementar
description: Executa o plano aprovado de uma entrega do Costura Pro despachando o papel implementer, um checkpoint por vez, e conferindo cada um. Use depois do plano do /entrega-iniciar, na sessão que o dono escolheu (a mesma do design ou uma nova, aberta pelo handoff), ou quando o dono pedir para executar um plano.
---

# Implementar

O agente principal coordena, confere e commita; o `implementer` escreve o código e os testes de cada checkpoint, sem commit. Cada passo termina num critério de pronto; só avance com ele cumprido.

1. **Preparação.** Confirme a branch da entrega (`git branch --show-current`) e leia do plano só o cabeçalho, as Global Constraints, o Review Focus, o mapa de arquivos e a tabela de checkpoints; as tarefas são lidas pelos implementers. O cabeçalho precisa da linha "Grill-with-docs: `grilling` e `domain-modeling` rodaram em <data>": sem ela, antes de qualquer despacho, chame o Skill tool com `grilling` e com `domain-modeling` sobre a spec e o plano (a `grill-with-docs` tem `disable-model-invocation` e não se chama sozinha), leve cada resposta ao plano e à spec e só então grave a linha. Pronto com a linha no cabeçalho, a lista de checkpoints no chat e o primeiro sem `- [x]` identificado.
2. **Despacho.** Um `implementer` por vez, com:
   - uma linha de onde o checkpoint fica na entrega;
   - o caminho do plano e "leia só as seções das tarefas N a M e as Global Constraints";
   - as interfaces e decisões de checkpoints anteriores que o plano não traz, e a sua resolução para as ambiguidades que perceber;
   - o scratchpad desta sessão para logs e o caminho do relatório, `<scratchpad>/checkpoint-<n>.md`.

   O despacho descreve só o checkpoint; o histórico dos anteriores fica nos relatórios e nos commits deles. Antes de despachar, confira a árvore limpa (`git status --porcelain` vazio; o plano e o resto de `docs/superpowers/` ficam fora do git) e anote no plano, ao lado do checkpoint, o commit base (`git rev-parse --short HEAD`), para ele sobreviver a uma compactação. Pronto com o implementer despachado.
3. **Conferência.** Com `DONE`:
   - `git add -A` e `git diff --cached --stat` (o diff contra o commit base, com os arquivos novos) bate com o mapa de arquivos do checkpoint;
   - o relatório mostra, por Grep, cada comportamento visto vermelho e depois verde;
   - checkpoint de tela traz as capturas de 320 px e do desktop, e você abre ao menos uma de cada;
   - ao fechar uma camada (domínio, banco, API, web), `pnpm check-types` uma vez, com saída em arquivo.

   Aceito o checkpoint, faça o commit dele na branch: mensagem em inglês no padrão conventional commits, que descreve o conteúdo sem citar fase, checkpoint, plano, spec nem ID de requisito ou decisão, com fonte e porta do harness juntas, e sem pular hook nem fazer amend. Hook que reprova volta ao implementer como correção. Pronto com o commit feito, a árvore limpa e o checkpoint marcado `- [x]` no plano, com o hash e o status ao lado.
4. **Desvios.**
   - `NEEDS_CONTEXT`: responda ao mesmo implementer por mensagem; o que depende do dono passa antes pelo `AskUserQuestion`.
   - `BLOCKED`: dê mais contexto, divida o checkpoint ou corrija o plano e anote a correção nele.
   - `DONE_WITH_CONCERNS`: decida e anote no plano antes do próximo checkpoint.

   Código se corrige pelo implementer; você edita só o plano. Pronto quando o checkpoint voltar a `DONE`.
5. **Retomada.** Depois de compactação ou de sessão interrompida, o plano marcado, o `git log` e o `git status` dizem onde parar: o que está marcado e commitado fica como está, e mudança sem commit do primeiro checkpoint sem marca passa pelo passo 3, contra o commit base anotado no plano, antes de ser commitada ou redespachada.
6. **Fim.** Com todos os checkpoints marcados, rode `/entrega-fechar`. Falha da bateria do `/verificar` e achados do `/revisar` vão ao implementer num único despacho por rodada, com a lista inteira, os logs e o teste que cada correção precisa; a correção entra em commit novo depois de conferida, nunca por amend, e a nova revisão lê só `git diff <commit antes da rodada>..HEAD`; falha da bateria passa antes pelo `superpowers:systematic-debugging`, para o despacho levar a causa e não o sintoma. Pronto com o `/entrega-fechar` em andamento.

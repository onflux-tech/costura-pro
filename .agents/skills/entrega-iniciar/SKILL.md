---
name: entrega-iniciar
description: Abre uma entrega do ROADMAP do Costura Pro com branch, rota, spec local, grill-with-docs (grilling e domain-modeling), plano e a escolha, pelo dono, da sessão onde a execução roda. Use no começo de toda entrega, quando o dono pedir para começar uma fase, pendência ou requisito (RF), ou antes do primeiro Edit em código de produto fora de um plano em execução.
---

# Iniciar entrega

Cada passo termina num critério de pronto; só avance com ele cumprido.

1. **Contexto.** Leia `docs/ROADMAP.md` (fase atual, pendências, spikes e critério de saída) e a linha correspondente da `docs/SPEC.md` §0. Pronto quando souber os RF envolvidos, o critério de saída e o que já existe no código.
2. **Escolha.** Proponha a próxima entrega pelo `AskUserQuestion`, com a recomendada primeiro; as dependências críticas do ROADMAP decidem a ordem. Pronto com a entrega confirmada pelo dono.
3. **Branch.** A partir da `main` atualizada, crie `<tipo>/<fase>-<slug>` (`feat`, `fix`, `chore` ou `docs`). Pronto quando `git branch --show-current` mostrar a branch nova e a árvore estiver limpa, ou o dono tiver aceitado o que está sujo.
4. **Rota.** Declare no chat:
   - **enxuta** para correção pequena de causa óbvia que não muda comportamento: TDD nesta sessão, `/verificar` e `/entrega-fechar`; os passos 5, 7 e 8 são só da rota completa;
   - **completa** para todo o resto: `superpowers:brainstorming`, spec, grill-with-docs sobre a spec, plano e `/implementar` na sessão que o dono escolher no passo 8.
5. **Spec e grill-with-docs (rota completa).** Copie [spec-template.md](spec-template.md) para `docs/superpowers/specs/` com data e slug no nome e preencha. Em seguida, sempre, e não só quando parecer haver decisão, passe a spec pelo grill-with-docs: ela tem `disable-model-invocation`, então o agente chama o Skill tool duas vezes, com `grilling` e com `domain-modeling`, e segue as duas. As rodadas do `grilling` vão pelo `AskUserQuestion`, com a recomendada primeiro; o `domain-modeling` grava na branch, na hora, o termo novo ou mudado no `CONTEXT.md` e o ADR da decisão de mão única, e a spec absorve cada resposta. Pronto quando cada item do DoD tiver comando e evidência esperada, cada contrato tiver o par de mutações morre e sobrevive, a fronteira do `grilling` estiver vazia e a spec disser, em Decisões, que as duas skills rodaram e o que mudou.
6. **Regras da área.** Leia as rules de `.claude/rules/` cujo `paths:` cobre os arquivos que vai tocar (a lista está no `AGENTS.md`) e a tabela "Antes de mexer em X, leia Y" do `docs/HARNESS.md`.
7. **Plano (rota completa).** `superpowers:writing-plans` no formato do implementer: cada tarefa se sustenta para quem lê só a própria seção e as Global Constraints, com arquivos, assinaturas, casos de teste com valores exatos, mensagens, constantes, SQL de migration custom e decisões; o mapa de arquivos traz também os testes que comparam a lista inteira do que a tarefa muda (colunas do schema, snapshot do `sync.pull`, payload da web), achados por busca antes de escrever o plano; código completo só onde o valor exato importa. O plano agrupa as tarefas em checkpoints de 1 a 3 tarefas coesas, em geral uma camada, não fixa scratchpad e abre com "Para agentes: execução com /implementar", seguido da sessão escolhida no passo 8 e da linha "Grill-with-docs: `grilling` e `domain-modeling` rodaram em <data>", que o `/implementar` confere. Pronto com o plano salvo e conferido contra a spec.
8. **Onde a execução roda (rota completa).** Com o plano salvo, pergunte ao dono pelo `AskUserQuestion`, com a recomendada primeiro e o motivo:
   - **esta sessão**: a recomendada, porque a medição do piloto (`docs/HARNESS.md` §9) deu mais tempo por mil linhas na execução em sessão nova do que a linha de base, sem ganho que compense; o `/implementar` segue despachando o `implementer`;
   - **sessão nova**, aberta com `claude --effort high`: recomendada só quando esta sessão já passa de 600 mil de contexto, porque aí a execução arriscaria compactar.

   Sessão nova: grave em `docs/superpowers/handoff/` e mostre no chat o prompt da execução, com branch, spec, plano e "Rode /implementar com esse plano; depois do último checkpoint siga o /entrega-fechar, e a integração roda sozinha em seguida"; a sessão de design termina aqui. Esta sessão: anote a escolha no cabeçalho do plano e rode `/implementar` em seguida. Pronto com o prompt no chat ou com o `/implementar` em andamento.

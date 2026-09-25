---
name: entrega-iniciar
description: Abre uma entrega do ROADMAP do Costura Pro com branch, rota, spec local, plano e o handoff da sessão de execução. Use no começo de toda entrega, quando o dono pedir para começar uma fase, pendência ou requisito (RF), ou antes do primeiro Edit em código de produto fora de um plano em execução.
---

# Iniciar entrega

Cada passo termina num critério de pronto; só avance com ele cumprido.

1. **Contexto.** Leia `docs/ROADMAP.md` (fase atual, pendências, spikes e critério de saída) e a linha correspondente da `docs/SPEC.md` §0. Pronto quando souber os RF envolvidos, o critério de saída e o que já existe no código.
2. **Escolha.** Proponha a próxima entrega pelo `AskUserQuestion`, com a recomendada primeiro; as dependências críticas do ROADMAP decidem a ordem. Pronto com a entrega confirmada pelo dono.
3. **Branch.** A partir da `main` atualizada, crie `<tipo>/<fase>-<slug>` (`feat`, `fix`, `chore` ou `docs`). Pronto quando `git branch --show-current` mostrar a branch nova e a árvore estiver limpa, ou o dono tiver aceitado o que está sujo.
4. **Rota.** Declare no chat:
   - **enxuta** para correção pequena de causa óbvia que não muda comportamento: TDD nesta sessão, `/verificar` e `/entrega-fechar`; os passos 5, 7 e 8 são só da rota completa;
   - **completa** para todo o resto: `superpowers:brainstorming`, spec, `grilling` quando houver decisão, plano e sessão de execução com `/implementar`.
5. **Spec (rota completa).** Copie [spec-template.md](spec-template.md) para `docs/superpowers/specs/` com data e slug no nome e preencha. Pronto quando cada item do DoD tiver comando e evidência esperada, e cada contrato tiver o par de mutações morre e sobrevive.
6. **Regras da área.** Leia as rules de `.claude/rules/` cujo `paths:` cobre os arquivos que vai tocar (a lista está no `AGENTS.md`) e a tabela "Antes de mexer em X, leia Y" do `docs/HARNESS.md`.
7. **Plano (rota completa).** `superpowers:writing-plans` no formato do implementer: cada tarefa se sustenta para quem lê só a própria seção e as Global Constraints, com arquivos, assinaturas, casos de teste com valores exatos, mensagens, constantes, SQL de migration custom e decisões; código completo só onde o valor exato importa. O plano agrupa as tarefas em checkpoints de 1 a 3 tarefas coesas, em geral uma camada, não fixa scratchpad e abre com "Para agentes: execução com /implementar numa sessão nova". Pronto com o plano salvo e conferido contra a spec.
8. **Handoff de execução (rota completa).** Grave em `docs/superpowers/handoff/` e mostre no chat o prompt da sessão de execução: branch, spec, plano e "Rode /implementar com esse plano; depois do último checkpoint siga o /entrega-fechar, e a integração roda sozinha em seguida". Peça ao dono para abrir a sessão com `claude --effort high` e colar o prompt; a sessão de design termina aqui. Pronto com o prompt no chat.

---
name: entrega-fechar
description: Fecha uma entrega do Costura Pro verificando, atualizando docs curadas e o índice e evoluindo o harness (rules, agents, skills, MCPs e falhas conhecidas). Use ao terminar uma implementação, antes de commit ou integração, e sempre que o hook de Stop pedir.
---

# Fechar entrega

O fechamento é o que torna o harness mais especialista a cada entrega. Cada passo termina num critério de pronto; só avance com ele cumprido.

1. **Verificar.** Rode `/verificar`. Pronto com todos os comandos verdes e o resultado de cada um no chat.
2. **Mapear o diff.** `git diff main...HEAD --stat` mais o que ainda não foi commitado. Escreva uma frase por arquivo. Pronto quando a lista cobrir o diff inteiro.
3. **Revisar.** Se a entrega toca dinheiro, quantidade, dados, autenticação, sync ou contrato entre camadas, rode `/revisar`; entrega só documental revisa inline, conforme o [orçamento de subagentes](../../../docs/HARNESS.md#4-ciclo-de-entrega-e-evolução-do-harness). Pronto com todo achado corrigido com teste ou recusado com evidência.
4. **Docs curadas.** Na mesma branch, seguindo "Quando uma decisão muda" do `AGENTS.md`:
   - `docs/SPEC.md`: contrato alterado e a linha da §0;
   - `docs/ROADMAP.md`: item em "Concluído" com data, pendências e tabela de rastreio;
   - `docs/PRD.md` §9, `CONTEXT.md` e `docs/adr/` quando decisão ou termo mudou;
   - `docs/areas/<area>.md`: doc da área quando ela acumulou conhecimento que não cabe numa rule (header `**Files:**`, Overview, tabelas, links relativos);
   - `docs/README.md`: todo doc novo entra no índice.

   Pronto quando cada arquivo do diff tiver o doc correspondente atualizado ou a anotação "sem impacto em docs".
5. **Evoluir o harness.** Liste o que a entrega ensinou e aplique os [critérios de evolução](../../../docs/HARNESS.md#4-ciclo-de-entrega-e-evolução-do-harness):
   - atualize direto: falha conhecida, rule da área e "Armadilhas conhecidas" de um papel;
   - pergunte ao dono pelo `AskUserQuestion` antes de criar papel, skill ou MCP.

   Pronto quando cada aprendizado tiver destino ou tiver sido descartado com motivo.
6. **Portas e checagens.** `pnpm harness:sync`, `pnpm harness:check`, `pnpm docs:check` e `pnpm harness:test`. Pronto com os quatro verdes.
7. **Próxima sessão.** Grave em `docs/superpowers/handoff/` um prompt autocontido para a próxima entrega (o que ficou pendente e por onde começar) e mostre no chat.
8. **Commit e integração.** Crie commits por área em inglês, no padrão conventional commits, com fonte e porta do harness juntas, e rode `/integrar-branch` em seguida, sem esperar pedido do dono. Pronto com o CI verde reportado.

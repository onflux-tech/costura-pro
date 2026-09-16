---
name: entrega-iniciar
description: Abre uma entrega do ROADMAP do Costura Pro com branch, rota e spec local. Use no começo de toda sessão de implementação, quando o dono pedir para começar uma fase, pendência ou requisito (RF), ou antes do primeiro Edit em código de produto.
---

# Iniciar entrega

Cada passo termina num critério de pronto; só avance com ele cumprido.

1. **Contexto.** Leia `docs/ROADMAP.md` (fase atual, pendências, spikes e critério de saída) e a linha correspondente da `docs/SPEC.md` §0. Pronto quando souber os RF envolvidos, o critério de saída e o que já existe no código.
2. **Escolha.** Proponha a próxima entrega pelo `AskUserQuestion`, com a recomendada primeiro; as dependências críticas do ROADMAP decidem a ordem. Pronto com a entrega confirmada pelo dono.
3. **Branch.** A partir da `main` atualizada, crie `<tipo>/<fase>-<slug>` (`feat`, `fix`, `chore` ou `docs`). Pronto quando `git branch --show-current` mostrar a branch nova e a árvore estiver limpa, ou o dono tiver aceitado o que está sujo.
4. **Rota.** Declare no chat:
   - **enxuta** para correção pequena de causa óbvia que não muda comportamento: siga direto para TDD;
   - **completa** para todo o resto: `superpowers:brainstorming`, spec, `grilling` quando houver decisão, plano.
5. **Spec (rota completa).** Copie [spec-template.md](spec-template.md) para `docs/superpowers/specs/` com data e slug no nome e preencha. Pronto quando cada item do DoD tiver comando e evidência esperada, e cada contrato tiver o par de mutações morre e sobrevive.
6. **Regras da área.** Leia as rules de `.claude/rules/` cujo `paths:` cobre os arquivos que vai tocar (a lista está no `AGENTS.md`) e a tabela "Antes de mexer em X, leia Y" do `docs/HARNESS.md`.
7. **Plano e execução.** `superpowers:writing-plans` e execução por checkpoint com TDD (teste vermelho antes do código). Terminada a implementação, rode `/entrega-fechar`.

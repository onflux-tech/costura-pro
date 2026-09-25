---
name: integrar-branch
description: Integra a branch de uma entrega do Costura Pro na main e envia ao remoto. Roda automaticamente no fim do /entrega-fechar e também quando o dono pedir merge, integrar, publicar ou push.
effort: medium
---

# Integrar branch

O fluxo do dono é merge local na `main` seguido de push, automático ao fim de cada entrega por autorização permanente; não há PR.

1. **Entrega fechada.** Confirme na branch que `/entrega-fechar` rodou e que `pnpm harness:check`, `pnpm docs:check` e `/verificar` estão verdes. Pronto com a evidência no chat.
2. **Merge local linear.** `git switch main` e `git merge --ff-only <branch>`. Se a `main` andou, volte à branch, rode `git rebase main`, repita a verificação e tente de novo. Pronto quando `git log --oneline -5` mostrar os commits da entrega na `main`.
3. **Checagem pós-merge.** Na `main`, rode `pnpm harness:check`, `pnpm docs:check` e `pnpm test`. Pronto com os três verdes.
4. **Push.** Mostre `git log origin/main..main --oneline` e rode `git push origin main` sem pedir confirmação, filtrando da saída a URL do remoto. Nunca force-push. Pronto com o push aceito.
5. **CI.** Acompanhe o workflow do push (`gh run list --branch main --limit 1` e `gh run watch`). CI vermelho reabre a entrega. Pronto com o CI verde reportado.
6. **Limpeza.** Com o CI verde, apague a branch local com `git branch -d <branch>`.

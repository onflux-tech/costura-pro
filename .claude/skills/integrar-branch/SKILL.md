---
name: integrar-branch
description: Integra a branch de uma entrega do Costura Pro na main localmente e envia ao remoto depois de confirmação. Use quando o dono pedir merge, integrar, publicar ou push de uma entrega fechada.
---

# Integrar branch

O fluxo do dono é merge local na `main` e só depois push; não há PR.

1. **Entrega fechada.** Confirme na branch que `/entrega-fechar` rodou e que `pnpm harness:check`, `pnpm docs:check` e `/verificar` estão verdes. Pronto com a evidência no chat.
2. **Merge local linear.** `git switch main` e `git merge --ff-only <branch>`. Se a `main` andou, volte à branch, rode `git rebase main`, repita a verificação e tente de novo. Pronto quando `git log --oneline -5` mostrar os commits da entrega na `main`.
3. **Checagem pós-merge.** Na `main`, rode `pnpm harness:check`, `pnpm docs:check` e `pnpm test`. Pronto com os três verdes.
4. **Push com confirmação.** Mostre `git log origin/main..main --oneline` e pergunte pelo `AskUserQuestion` se pode enviar. Só com sim: `git push origin main`. Nunca force-push.
5. **CI.** Acompanhe o workflow do push (`gh run list --branch main --limit 1` e `gh run watch`). CI vermelho reabre a entrega. Pronto com o CI verde reportado.
6. **Limpeza.** Com o CI verde, apague a branch local com `git branch -d <branch>`.

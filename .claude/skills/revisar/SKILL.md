---
name: revisar
description: Despacha revisão independente do diff de uma entrega do Costura Pro para os papéis reviewer e contract. Use antes de fechar entrega que toque dinheiro, quantidade, dados, autenticação, sync ou contrato entre camadas, ou quando o dono pedir review.
---

# Revisar

1. **Salvar o diff.** Grave `git diff main...HEAD` (numa rodada de correção, `git diff <commit antes da rodada>..HEAD`) e, se houver, `git diff HEAD` num arquivo do scratchpad; arquivo novo entra por `git diff --no-index -- /dev/null <arquivo>` anexado ao mesmo arquivo, nunca por `git add -N`, que recusa o pre-commit. O `reviewer` não tem shell e lê só arquivos.
2. **Despachar.** Envie ao `reviewer`:
   - caminho do diff, spec local e DoD;
   - RF, RNF e ADRs afetados;
   - restrições que o diff não mostra;
   - desafio de mutação: para cada contrato, qual mudança no código deveria quebrar qual teste.

   Se a mudança cruza web, API, domínio, banco, desktop ou offline, despache também o `contract`, em paralelo com o `reviewer`.
3. **Passar fatos, não conclusões.** Não pré-julgue severidade nem afirme que já verificou.
4. **Tratar achados.** Mande os achados confirmados num único despacho ao `implementer`, com a lista inteira e o teste que cada correção precisa; na rota enxuta, sem plano em execução, corrija você mesmo, com teste. Recuse com evidência de arquivo e linha o que não procede. Pronto quando nenhum achado estiver sem destino.
5. **Aprender.** Achado que revela armadilha recorrente entra no passo "Evoluir o harness" do `/entrega-fechar`.

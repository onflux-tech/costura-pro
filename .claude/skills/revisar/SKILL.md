---
name: revisar
description: Despacha revisão independente do diff de uma entrega do Costura Pro para os papéis reviewer e contract. Use antes de fechar entrega que toque dinheiro, quantidade, dados, autenticação, sync ou contrato entre camadas, ou quando o dono pedir review.
---

# Revisar

1. **Salvar o diff.** Grave `git diff main...HEAD` e, se houver, `git diff HEAD` num arquivo do scratchpad; arquivo novo entra por `git diff --no-index -- /dev/null <arquivo>` anexado ao mesmo arquivo, nunca por `git add -N`, que recusa o pre-commit. O `reviewer` não tem shell e lê só arquivos.
2. **Despachar.** Envie ao `reviewer`:
   - caminho do diff, spec local e DoD;
   - RF, RNF e ADRs afetados;
   - restrições que o diff não mostra;
   - desafio de mutação: para cada contrato, qual mudança no código deveria quebrar qual teste.

   Se a mudança cruza web, API, domínio, banco, desktop ou offline, despache também o `contract`, em paralelo. No máximo 2 subagentes.
3. **Passar fatos, não conclusões.** Não pré-julgue severidade nem afirme que já verificou.
4. **Tratar achados.** Corrija com teste, ou recuse com evidência de arquivo e linha. Pronto quando nenhum achado estiver sem destino.
5. **Aprender.** Achado que revela armadilha recorrente entra no passo "Evoluir o harness" do `/entrega-fechar`.

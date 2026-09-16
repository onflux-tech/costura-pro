---
status: accepted
date: 2026-09-15
---

# Preservar movimentos e corrigir custo por novos eventos

Estoque e finanças registram movimentos auditáveis, e saldos são projeções, nunca a fonte da verdade. Consumo ou venda real que deixa o saldo negativo é aceito com custo provisório e pendência de compra; quando a reposição chega, um ajuste de custo referencia o evento original sem reescrevê-lo. Em ateliê, cortar tecido antes de lançar a compra é comum, e bloquear o registro faria o sistema divergir da realidade.

## Opções consideradas

- **Bloquear aprovação ou consumo sem saldo:** força lançamentos fictícios para destravar o trabalho.
- **Congelar o último custo conhecido ou usar custo zero:** margem fica errada sem caminho de correção.
- **Editar o movimento original quando a compra chegar:** apaga o rastro de por que a margem mudou.
- **Última gravação vence para fatos concorrentes:** perderia vendas e pagamentos reais feitos offline.

## Consequências

- Fatos concorrentes (venda, pagamento, consumo) viram exceções visíveis, como sobre-venda e excedente a reembolsar.
- Edições de campos sobre versão-base desatualizada, ao contrário, vão para a caixa de conflitos.
- Correções são estornos ou ajustes novos; documentos emitidos e movimentos nunca são apagados.

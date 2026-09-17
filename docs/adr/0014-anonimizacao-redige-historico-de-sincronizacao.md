---
status: accepted
date: 2026-09-17
---

# Anonimização redige o histórico de sincronização

Anonimizar um cliente troca, na mesma transação, os dados pessoais da linha viva e de todos os lugares onde o sync guardou cópia deles: os snapshots antigos do `change_log`, os valores de `sync_conflict`, o `op_hash` e o `current` de resultado de conflito em `operation`. O `change_log` continua append-only para todo o resto; a trigger aceita só a troca de `data` de um agregado registrado em `redacted_aggregate`, sem mudar cursor, tipo, id, versão, epoch, `op_id` nem data. A anonimização é uma procedure direta, só no acesso local, e não existe como comando de sync. Complementa a [ADR 0013](0013-contrato-minimo-de-sincronizacao.md), que definiu o `change_log` com snapshots completos.

## Opções consideradas

- **`change_log` sem dados, com o pull lendo o estado atual das tabelas:** dado pessoal ficaria só na linha viva, mas reescreveria o pull e os agregados já revisados e perderia o histórico de versões que um merge mais fino no offline pode precisar.
- **Limpar só a linha viva:** um aparelho que fizesse rebase receberia os dados antigos, o que contradiz a definição de anonimização do glossário.
- **Apagar as linhas antigas do `change_log`:** deixaria lacunas de cursor sem ganho sobre a troca de `data`, e o DELETE aberto enfraqueceria o append-only.
- **Anonimizar também pelo sync:** uma edição offline de outro aparelho chegaria depois e reabriria conflito com os valores pessoais.

## Consequências

- `redacted_aggregate` é append-only e guarda tipo, id, `opId` e data de cada agregado redigido.
- O hash de um patch curto (só telefone, com `opId`, id e versão conhecidos) se inverteria por força bruta, então o `op_hash` das operações desses agregados vira a marca `redacted`; repetir uma dessas operações responde como `opId` reutilizado.
- Conflitos abertos desses agregados fecham com `keepServer`, e todos, abertos ou já resolvidos, ficam com valores vazios e motivo "Cliente anonimizado", porque o motivo é texto livre do dono.
- A resolução de conflito (`sync.resolve`) grava na `operation` o agregado do conflito, para a redação alcançar o hash dos valores de um `merge`.
- Qualquer comando posterior sobre o cliente ou seus perfis é recusado: `PRECONDITION_FAILED` na procedure direta e quarentena `aggregateAnonymized` no push. Operação que chega depois (aparelho offline) e toca agregado redigido, ou que cai em `aggregateAnonymized`, já é gravada com `op_hash` `redacted`; criação posta em quarentena por pai inexistente também, porque o perfil que não nasceu não tem como ser ligado ao cliente depois.
- O banco abre com `PRAGMA secure_delete = ON` e a anonimização termina com `PRAGMA wal_checkpoint(TRUNCATE)`, para os valores antigos não ficarem nos bytes livres do arquivo nem no WAL.
- Cópias de backup feitas antes da anonimização guardam os dados até saírem da retenção, e aparelhos do espelho offline só recebem a versão anonimizada no próximo pull.
- Agregado futuro com dado pessoal (peça recebida, medições, compromissos) entra na mesma redação.

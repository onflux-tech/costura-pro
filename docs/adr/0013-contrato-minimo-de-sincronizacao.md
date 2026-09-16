---
status: accepted
date: 2026-09-16
---

# Contrato mínimo de sincronização por operação, cursor e epoch

Todo comando que muda estado grava seu resultado na tabela `operation`, indexada por `opId`, na mesma transação do efeito e junto com o SHA-256 do JSON canônico da operação. O sync roda como procedures oRPC (`sync.push`, `sync.pull`, `sync.resolve`, `sync.pending`) autenticadas pela sessão do dono e por um segredo de dispositivo de 256 bits. Cada operação do `push` é decidida numa transação curta, nesta ordem: `opId` já gravado, dispositivo, epoch, comando, payload, agregado e versão-base. O `pull` entrega snapshots do `change_log` por cursor inteiro crescente e pede `rebase` quando o epoch do cliente difere do servidor. O epoch é um UUIDv4 novo a cada restauração ([ADR 0004](0004-backup-epoch-e-cofre-por-dispositivo.md)).

## Opções consideradas

- **Rotas Hono em `/api/sync/*`:** duplicariam validação, contexto de sessão e cliente fora do oRPC.
- **Dispositivo identificado só pelo `deviceId` ou pela sessão:** quem tem a senha se passaria por qualquer aparelho aprovado, ou cada novo login pediria reaprovação.
- **`opId` repetido sempre devolve o resultado gravado:** esconderia outbox corrompida ou bug do cliente que reutiliza `opId` com outro conteúdo.
- **Erro em vez de `rebase` no pull de epoch antigo:** um contrato a mais para o cliente sem ganho.
- **Epoch como contador:** restaurar duas vezes o mesmo backup repetiria o número e aceitaria operações da geração errada.

## Consequências

- Mesmo `opId` e mesmo hash devolvem o resultado gravado; hash diferente vira quarentena `opIdReused` sem tocar o original.
- Epoch diferente vira quarentena `epoch` antes de qualquer comparação de versão; versão-base diferente vira conflito aberto com valores locais e atuais lado a lado.
- Nada é descartado: quarentena e conflito também ficam gravados e aparecem em `sync.pending`. Um item malformado vira quarentena `invalidEnvelope` sem barrar o resto do lote.
- Resolver um conflito é uma operação com `opId` (`keepLocal`, `keepServer` ou `merge`, com motivo) e só acontece uma vez.
- Dispositivo pendente ou revogado recebe `FORBIDDEN`; aprovação e revogação são ações do acesso local, diretas ou por código de ativação de uso único.
- Agregados novos entram registrando comandos no mesmo registro (`installation.setAtelierName` e `device.rename` na primeira versão) e gravando snapshot no `change_log` a cada mudança de versão.

---
status: accepted
date: 2026-09-15
---

# Atualizar binários e banco em conjunto

O updater assinado do Tauri verifica o próprio artefato, mas não coordena servidor Bun, migrations SQLite e serviços do sistema. Um supervisor de instalação aplica a atualização numa janela ociosa: pausa escritas, cria pré-backup, troca componentes, migra, testa saúde e, se algo falhar, reverte binários e banco juntos. Voltar só o binário sobre um schema já migrado poderia corromper a operação.

## Opções consideradas

- **Reverter só binários:** seguro apenas se toda migration fosse retrocompatível, o que não se garante.
- **Sem rollback automático:** deixaria o ateliê parado até intervenção técnica.
- **Atualização manual pelo dono:** contraria o requisito de instalação simples.

## Consequências

- Releases públicos no GitHub com artefatos assinados; a chave privada nunca fica no repositório.
- Operações aceitas antes da janela nunca são descartadas.
- `cloudflared` é atualizado separadamente, sem tocar no token.
- O instalador inicial pode mostrar SmartScreen enquanto não houver certificado comercial.
- Desde 2026-09-16 não há app desktop nem updater do Tauri ([ADR 0011](0011-servico-do-so-e-acesso-local-no-navegador.md)): o supervisor é o único canal de atualização e verifica a assinatura minisign dos artefatos antes de trocar qualquer um.

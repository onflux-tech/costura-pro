---
status: superseded
date: 2026-09-15
---

# Servidor como serviço do sistema e Tauri só como administração

Substituído em 2026-09-16 pelo [ADR 0011](0011-servico-do-so-e-acesso-local-no-navegador.md): o PC usa a interface no navegador, sem app desktop.

O servidor Hono/Bun e o `cloudflared` rodam como serviços do sistema operacional, iniciados no boot, e o app Tauri é apenas o painel de operação e administração local. A Cloudflare recomenda o conector como serviço, e o acesso móvel precisa continuar funcionando com a janela do Tauri fechada ou sem ninguém logado no Windows.

## Opções consideradas

- **Tauri na bandeja controlando o servidor:** fechar o app derrubaria o acesso móvel.
- **Só `cloudflared` como serviço:** o Tunnel ficaria de pé apontando para um servidor parado.
- **Docker Desktop:** exige instalar e manter Docker num PC de ateliê.
- **Comandos no terminal:** exige alguém técnico para iniciar e atualizar.

## Consequências

- Instalação por máquina, com elevação de administrador no Windows e `systemd` no Ubuntu 24.04 LTS.
- Banco e mídia ficam fora do diretório de instalação: `%PROGRAMDATA%\CosturaPro\data` no Windows e `/var/lib/costura-pro` no Linux, com permissões restritas.
- Desinstalar preserva dados e backups, salvo pedido explícito.
- Restauração, backup, Tunnel, atualização e aprovação de dispositivo são ações do desktop local.

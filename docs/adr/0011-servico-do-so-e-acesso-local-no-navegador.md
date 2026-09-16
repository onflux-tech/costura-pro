---
status: accepted
date: 2026-09-16
---

# Servidor como serviço do sistema e acesso local pelo navegador

O servidor Bun compilado e o `cloudflared` rodam como serviços do sistema operacional, iniciados no boot e sem login, e o PC do ateliê usa a mesma interface web pelo navegador na origem local `http://127.0.0.1:<porta>`, sem app desktop. Substitui o [ADR 0007](0007-servico-do-so-e-tauri-administrativo.md), que mantinha o Tauri como painel de administração. Em 2026-09-16 o app Tauri do repositório era só uma janela sobre esse loopback: o servidor não distingue essa janela de um navegador, e o que ela prometia a mais (seletor de pasta, notificações e administração local) se resolve sem casca nativa.

## Opções consideradas

- **Manter o Tauri mínimo:** traz Rust e MSVC ao build, WebKitGTK no Ubuntu (motor diferente do Chromium, com problemas gráficos e de cookie `Secure` documentados), migração para a v3 (em alpha desde 2026-09-13), IPC aberto a todo conteúdo do loopback via `remote.urls` e um segundo canal de atualização ao lado do supervisor do [ADR 0005](0005-atualizacao-coordenada.md).
- **Trocar por Electron:** mesmo Chromium nos dois PCs, mas cerca de 150 MiB de runtime por atualização, duas trocas de major por ano para seguir suportado e atualização sem autenticidade enquanto não houver certificado comercial.
- **Serviço com NSSM:** sem release desde 2017, sem assinatura, marcado por antivírus e com 1,5 s por método de parada, pouco para fechar o SQLite com calma.
- **App na bandeja controlando o servidor:** fechar o app derrubaria o acesso móvel (já descartado no ADR 0007).
- **Docker Desktop:** exige instalar e manter Docker num PC de ateliê.
- **Comandos no terminal:** exige alguém técnico para iniciar e atualizar.

## Consequências

- Instalação por máquina: NSIS 3.12 ou superior no Windows, com o wrapper de serviço escolhido no S5 entre shawl e WinSW 2.12 NET461, e `.deb` com `systemd` no Ubuntu 24.04 LTS. O Bun não atende o gerenciador de serviços do Windows sem wrapper.
- O instalador cria atalho para `msedge.exe --app=http://127.0.0.1:<porta>/`, com o navegador padrão quando não houver Edge; no Ubuntu, um `.desktop` abre Google Chrome ou Chromium com `--app` e usa `xdg-open` quando não houver nenhum.
- A origem local é a identidade da interface no PC (cookie, service worker e cache): a porta é fixada no S5, antes do primeiro instalador, e nunca mais muda.
- Backup, restauração, Tunnel, atualização e aprovação de dispositivo são ações do **acesso local**: Host de loopback, sem cabeçalhos da Cloudflare e com sessão do dono. Qualquer processo do PC alcança o loopback, como já acontecia com a janela do Tauri, então sessão e código de recuperação continuam obrigatórios onde a SPEC pede.
- A pasta de backup é escolhida num navegador de pastas alimentado pelo servidor, que mostra o que a conta do serviço enxerga; letra de unidade mapeada não existe para o serviço.
- Notificação no PC só com a interface aberta. Aviso com tudo fechado exige um processo na sessão do usuário (bandeja), que pode ser acrescentado depois sem mudar contrato.
- O supervisor do ADR 0005 é o único canal de atualização e verifica assinatura minisign; a SignPath Foundation é avaliada na F7 para assinar os executáveis.
- A conta do serviço sai do S5: conta virtual primeiro, LocalSystem só com motivo registrado.
- Banco e mídia continuam fora do diretório de instalação (`%PROGRAMDATA%\CosturaPro\data` e `/var/lib/costura-pro`) com permissões restritas, e desinstalar preserva dados e backups, salvo pedido explícito.
- Caminho de volta: interface e contratos não dependem de casca. Uma janela Tauri ou Electron pode voltar a apontar para a mesma origem local sem mudar servidor nem dados; o que não volta barato é trocar a origem local.

Fontes e datas de consulta em [REFERENCIAS §3](../REFERENCIAS.md#3-documentação-externa).

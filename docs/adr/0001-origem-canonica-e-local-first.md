---
status: accepted
date: 2026-09-15
---

# Origem HTTPS única para a PWA local-first

O PC do ateliê é a autoridade dos dados e opera sem internet, mas a PWA móvel usa somente o subdomínio HTTPS servido pelo Cloudflare Tunnel. Service worker exige contexto seguro, então HTTP por IP da LAN não instala a PWA offline, e acessar pela LAN e pelo Tunnel criaria duas origens com sessão, instalação e IndexedDB separados no mesmo celular. O dono não terá acesso administrativo ao roteador, o que descarta DNS local com o mesmo subdomínio.

## Opções consideradas

- **LAN como acesso principal por HTTP:** quebra PWA offline e câmera por falta de contexto seguro.
- **Mesmo subdomínio resolvido para o PC na LAN (DNS local + certificado):** preserva uma origem, mas exige roteador configurável.
- **Duas origens (LAN HTTPS e Tunnel):** duplica dados locais, sessão e instalação no aparelho.

## Consequências

- Sem internet, o celular continua operando pelo cofre e pela outbox, mas só sincroniza quando o Tunnel volta.
- O desktop Tauri fala direto com o servidor em loopback e segue operando offline.
- O servidor escuta apenas `127.0.0.1`; nenhuma porta HTTP é exposta na LAN.
- Cloudflare Tunnel é opcional para uso só no PC, mas obrigatório para a PWA móvel.

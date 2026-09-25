# Referências (uso interno)

| Campo | Valor |
|---|---|
| Para que serve | Versões fixadas, alternativas descartadas, fontes externas e origem das decisões do [PRD](PRD.md) |
| Levantamento | 2026-09-16 |
| Atenção | Cita caminhos e repositórios locais do dono. Não compartilhar fora do projeto |

## Sumário

1. [Stack e versões](#1-stack-e-versões)
2. [Alternativas descartadas](#2-alternativas-descartadas)
3. [Documentação externa](#3-documentação-externa)
4. [Origem das decisões](#4-origem-das-decisões)
5. [Harnesses de referência](#5-harnesses-de-referência)

## 1. Stack e versões

Fonte de verdade: `package.json` de cada pacote, catálogo em `pnpm-workspace.yaml`, `pnpm-lock.yaml` e `bts.jsonc`. Para saber a versão atual, leia esses arquivos; esta tabela registra o que estava fixado em 2026-09-16.

| Camada | Tecnologia | Versão |
|---|---|---|
| Gerador | Better-T-Stack (`create-better-t-stack`) | 3.43.1 |
| Gerenciador de pacotes | pnpm (`packageManager`) | 11.20.0 |
| Runtime do servidor e testes | Bun | 1.4.2 |
| Scripts do harness | Node.js | 24 |
| Monorepo | Turborepo | ^2.10.12 |
| Linguagem | TypeScript | ^6.0.3 |
| Lint e formatação | Biome com Ultracite | 2.5.12 e 7.11.0 |
| Git hooks | Lefthook | latest |
| Servidor HTTP | Hono | ^4.13.7 |
| API tipada | oRPC | ^1.15.0 |
| Autenticação | Better Auth | 1.7.3 |
| ORM | Drizzle ORM e drizzle-kit | ^0.45.2 e ^0.31.10 |
| Banco | SQLite via `bun:sqlite` | do Bun |
| Validação | Zod | ^4.5.4 |
| Variáveis de ambiente | Varlock | 1.18.0 |
| Logs | evlog | ^2.28.1 |
| Frontend | React e React DOM | ^19.2.8 |
| Roteamento e dados | TanStack Router, Query e Form | ^1.170.32, ^5.102.8 e ^1.33.5 |
| Build web | Vite | ^8.2.2 |
| PWA | vite-plugin-pwa | ^1.3.0 |
| Estilo | Tailwind CSS | ^4.3.3 |
| Componentes | shadcn (sobre Base UI), estilo `base-vega` | ^4.21.0 |
| Instalador Windows (previsto) | NSIS | 3.12 ou superior |
| Wrapper de serviço no Windows (previsto) | shawl ou WinSW 2.12 NET461 | a definir no S5 |
| Pacote Ubuntu (previsto) | nFPM | a definir na F7 |
| Espelho offline (previsto) | Dexie | a definir na F6 |
| Primitivas de interface | Base UI | ^1.8.0 |
| Fontes empacotadas | `@fontsource-variable` (Geist, Source Serif 4, JetBrains Mono) | ^5.3.0 |

MCPs e skills do projeto estão em [HARNESS §2](HARNESS.md#2-matriz-ferramenta--artefato).

## 2. Alternativas descartadas

| Alternativa | Por que não | Onde está a decisão |
|---|---|---|
| Cadastro HTTP do Better Auth com hook `before` depois do bootstrap | Durante o bootstrap qualquer cliente disputa a conta; o dono nasce por comando local | DEC-60, [ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md) |
| `disabledPaths` do Better Auth | Rota nova de versão futura nasceria aberta, e o bloqueio vale só no HTTP | DEC-60, [ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md) |
| Bloqueio de login por username digitado | Revelaria se o usuário existe e trancaria o dono também no PC | DEC-61, [ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md) |
| Códigos de recuperação com scrypt ou HMAC do segredo | scrypt multiplica o custo sem ganho sobre 80 bits; HMAC deixa de valer quando o segredo se perde numa restauração | DEC-62, [ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md) |
| Rotas Hono `/api/sync/*` | Duplicariam validação, sessão e cliente fora do oRPC | DEC-63, [ADR 0013](adr/0013-contrato-minimo-de-sincronizacao.md) |
| Epoch como contador inteiro | Restaurar duas vezes o mesmo backup repete o número | DEC-63, [ADR 0013](adr/0013-contrato-minimo-de-sincronizacao.md) |
| libSQL e Turso (gerados pelo scaffold) | Cliente orientado a banco remoto, sem ganho para um PC | [ADR 0006](adr/0006-sqlite-nativo-bun.md) |
| `node:sqlite` dentro do Bun | Marcado como não implementado no Bun | [ADR 0006](adr/0006-sqlite-nativo-bun.md) |
| `drizzle-kit migrate` | Não executa migrations com `bun:sqlite`; procura `@libsql/client` ou `better-sqlite3` | [ADR 0006](adr/0006-sqlite-nativo-bun.md) |
| Playwright | O dono valida interface com browser-harness em navegador real | DEC-50 |
| Docker Desktop | Instalar e manter Docker num PC de ateliê | [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md) |
| App Tauri no PC | Janela sobre o loopback sem ganho sobre o navegador; Rust e MSVC no build, WebKitGTK no Ubuntu, migração para a v3, IPC aberto ao loopback e segundo canal de atualização | DEC-59, [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md) |
| Electron como app desktop | Cerca de 150 MiB de runtime, duas majors por ano e `electron-updater` sem autenticidade sem Authenticode | DEC-59, [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md) |
| NSSM como wrapper de serviço | Sem release desde 2017, sem assinatura, marcado por antivírus e 1,5 s por método de parada | DEC-59, [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md) |
| Serviço nativo do Bun por `bun:ffi` | FFI experimental, sem entrypoint de serviço do Windows | DEC-59 |
| PWA instalada por `WebAppInstallForceList` do Edge | O Edge passa a mostrar "gerenciado pela organização" e a instalação a partir de 127.0.0.1 fora de domínio não foi provada | DEC-59 |
| `showDirectoryPicker` para a pasta de backup | Devolve handle do navegador, não caminho; o serviço grava com o navegador fechado | DEC-59 |
| Azure Artifact Signing | Indisponível para organização ou pessoa física no Brasil em 2026-09 | DEC-59 |
| Acesso pela LAN por HTTP ou DNS local | Service worker exige contexto seguro; dono sem acesso ao roteador | [ADR 0001](adr/0001-origem-canonica-e-local-first.md) |
| Cloudflare Access na frente do app | Complica instalação e sessão da PWA; o login do app com defesas basta | DEC-43 |
| Token de API da conta Cloudflare | Permissão ampla demais; basta o token do tunnel | DEC-46 |
| Cópia direta do arquivo SQLite em WAL | Não garante consistência; usar `VACUUM INTO` | [SPEC §6](SPEC.md#6-documentos-backup-restauração-e-atualização) |
| CSV na v1 | Fora do escopo; portabilidade pelo pacote de backup | DEC-04 |
| Wireframes HTML navegáveis | Descartados na migração para Windows; a interface nasce do design system | DEC-52 |
| Storybook 10 com addon de acessibilidade | Toolchain e major anual a mais para um dono só; a automação de acessibilidade exige Playwright | DEC-68 |
| Google Fonts | Sem offline na PWA e requisição externa a cada carga | DEC-66 |
| Tema escuro | Cada cor e contraste desenhados e conferidos duas vezes sem pedido real | DEC-66 |
| Menu lateral no desktop e 13 destinos soltos | O design desenhou barra horizontal; soltos, os menos usados caíam num "Mais" sem nome | DEC-67 |
| Symlinks para espelhar skills | Viram arquivo de texto num clone Windows sem Developer Mode | [HARNESS §1](HARNESS.md#1-decisões-do-harness) |
| Duas instâncias do Better Auth por Host, ou `baseURL` dinâmica com `crossSubDomainCookies` | Nome de cookie diferente por origem, ou `Domain` injetado e dependência de detalhe interno; um middleware por Host resolve com uma instância | DEC-56 |
| `shellEmulator` do pnpm, `cross-env` ou `env` do tsdown para `NODE_ENV=production` | Muda o shell de todos os scripts, traz dependência nova, ou só substitui texto no bundle sem chegar ao varlock e ao Better Auth; `bun --env-file` basta | [SPEC §1](SPEC.md#1-topologia-e-componentes) |
| MCPs better-t-stack, better-auth e cloudflare-docs | Scaffold concluído; documentação coberta pelo context7 | DEC-53 |
| Skills turborepo, vercel-react-best-practices e review-logging-patterns | Pipeline estável; foco em Next.js; evlog já adotado | DEC-53 |

## 3. Documentação externa

Consultas feitas nas sessões de planejamento de 2026-09-15, salvo indicação.

| Assunto | Fonte |
|---|---|
| Service worker exige contexto seguro | [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) |
| Arquitetura e origem de PWA; isolamento no iOS | [web.dev: PWA architecture](https://web.dev/learn/pwa/architecture), [web.dev: detection](https://web.dev/learn/pwa/detection) |
| Política de armazenamento do WebKit | [WebKit: storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) |
| Tunnel remotamente gerenciado e token | [Cloudflare Tunnel: get started](https://developers.cloudflare.com/tunnel/get-started/), [local management](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/), [permissões do token](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/remote-tunnel-permissions/) |
| Backup online do SQLite | [SQLite: backup API](https://www.sqlite.org/backup.html) |
| SQLite no Bun e `node:sqlite` | [Bun: SQLite](https://bun.com/docs/runtime/sqlite), [Bun: node:sqlite](https://bun.com/reference/node/sqlite) |
| Executável standalone do Bun | [Bun: executables](https://bun.com/docs/bundler/executables) |
| Drizzle com Bun SQLite | [Drizzle: Bun SQLite](https://orm.drizzle.team/docs/get-started/bun-sqlite-new) |
| Updater do Tauri | [Tauri v2: updater](https://v2.tauri.app/plugin/updater/) |
| Better Auth: username, rate limit e hooks | [plugin Username](https://better-auth.com/docs/plugins/username), [rate limit](https://better-auth.com/docs/concepts/rate-limit), [hooks](https://better-auth.com/docs/concepts/hooks) |
| Better-T-Stack para agentes | [Better-T-Stack: agent workflows](https://www.better-t-stack.dev/docs/cli/agent-workflows) |
| Descoberta de skills, subagents e MCP no Claude Code (2026-09-16) | [skills](https://code.claude.com/docs/en/skills.md), [subagents](https://code.claude.com/docs/en/sub-agents.md), [MCP](https://code.claude.com/docs/en/mcp-configuration.md) |
| Subagentes, hooks `SubagentStart` e `SubagentStop`, esforço por papel e por skill e rules por caminho no Claude Code (2026-09-24) | [sub-agents](https://code.claude.com/docs/en/sub-agents.md), [hooks](https://code.claude.com/docs/en/hooks.md), [skills](https://code.claude.com/docs/en/skills.md), [model-config](https://code.claude.com/docs/en/model-config.md), [memory](https://code.claude.com/docs/en/memory.md) |
| Subagentes e custo no Codex | [Codex: subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Codex: pricing](https://learn.chatgpt.com/docs/pricing) |
| Host e headers que o `cloudflared` entrega à origem; `httpHostHeader` (2026-09-16) | [Cloudflare Tunnel: origin parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/cloudflared-parameters/origin-parameters/), [cloudflared: origin_proxy.go](https://github.com/cloudflare/cloudflared/blob/master/ingress/origin_proxy.go), [Cloudflare: HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/) |
| Cookie `Secure` e prefixos em `http://localhost` por motor (2026-09-16) | [httpwg: issue 2605](https://github.com/httpwg/http-extensions/issues/2605), [Tauri: issue 2604](https://github.com/tauri-apps/tauri/issues/2604), [libsoup: soup-cookie-jar.c](https://gitlab.gnome.org/GNOME/libsoup/-/blob/master/libsoup/cookies/soup-cookie-jar.c), [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) |
| Tauri com Vite, `frontendDist` como URL e capabilities locais (2026-09-16) | [Tauri v2: Vite](https://v2.tauri.app/start/frontend/vite/), [Tauri v2: capabilities](https://v2.tauri.app/security/capabilities/) |
| Identidade e telas de referência no Claude Design, projeto "Aplicativo atelier costura", arquivos `Costura Pro - Telas.dc.html`, `TopNav.dc.html` e `MobileNav.dc.html` (2026-09-16) | [Claude Design: projeto](https://claude.ai/design/p/c40b024b-7619-4657-a87c-ce3ed5285e36) (privado do dono) |
| Tela 02 do Claude Design (ficha com perfis à esquerda, painel "Medidas" com modelo e versão, grade de valores com uma casa, diferença "↑ 1,5", botões Histórico e Editar medidas; sub-aba "Modelos de medidas" do Catálogo sem tela desenhada), lida pelo DesignSync (2026-09-17) | [Claude Design: projeto](https://claude.ai/design/p/c40b024b-7619-4657-a87c-ce3ed5285e36) (privado do dono) |
| Chrome DevTools Protocol, domínio `Fetch`: pausa na etapa de resposta e `failRequest`, usado para simular resposta perdida depois de o servidor gravar (2026-09-17) | [CDP: Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/) |
| Estilos visuais do shadcn (Vega, Nova, Maia, Lyra, Mira) (2026-09-16) | [shadcn: changelog 2025-12](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create) |
| Divisão manual de chunks no Rolldown (`codeSplitting.groups`) (2026-09-16) | [Rolldown: manual code splitting](https://rolldown.rs/in-depth/manual-code-splitting) |
| Contraste mínimo de texto e de componente (WCAG 2.2, 1.4.3 e 1.4.11) (2026-09-16) | [WCAG 2.2: contrast minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum), [WCAG 2.2: non-text contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast) |
| Cache de SPA e service worker no deploy (2026-09-16) | [vite-plugin-pwa: deployment](https://vite-pwa-org.netlify.app/deployment/), [Hono: Bun](https://hono.dev/docs/getting-started/bun) |
| Tauri 2 e 3: versões, updater, capabilities remotas e gráficos no Linux (2026-09-16) | [crates.io: tauri](https://crates.io/crates/tauri), [Tauri v3.0.0-alpha.0](https://github.com/tauri-apps/tauri/releases/tag/tauri-v3.0.0-alpha.0), [Tauri v2: updater](https://v2.tauri.app/plugin/updater/), [Tauri v2: capabilities](https://v2.tauri.app/security/capabilities/), [Tauri v2: Linux graphics](https://v2.tauri.app/develop/debug/linux-graphics/), [Tauri: discussion 8524](https://github.com/tauri-apps/tauri/discussions/8524) |
| Electron: suporte, tamanho e atualização sem Authenticode; Open Design (2026-09-16) | [Electron: timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), [Electron: schedule](https://releases.electronjs.org/schedule), [Electron v44.4.0](https://github.com/electron/electron/releases/tag/v44.4.0), [electron-updater 6.8.9: NsisUpdater.ts](https://raw.githubusercontent.com/electron-userland/electron-builder/electron-updater@6.8.9/packages/electron-updater/src/NsisUpdater.ts), [Open Design](https://github.com/nexu-io/open-design) |
| Wrappers de serviço do Windows e serviço nativo (2026-09-16) | [NSSM: download](https://nssm.cc/download), [NSSM: usage](https://nssm.cc/usage), [Dr.Web: Tool.Nssm](https://vms.drweb.com/virus/?i=23405211), [WinSW: releases](https://github.com/winsw/winsw/releases), [WinSW v2: XML](https://github.com/winsw/winsw/blob/v2/doc/xmlConfigFile.md), [shawl](https://github.com/mtkennerly/shawl), [Servy](https://github.com/aelassas/servy), [StartServiceCtrlDispatcherW](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-startservicectrldispatcherw), [Bun: FFI](https://bun.com/docs/runtime/ffi), [oven-sh/bun#25824](https://github.com/oven-sh/bun/issues/25824) |
| Contas de serviço, unidades mapeadas e sessão 0 (2026-09-16) | [LocalSystem](https://learn.microsoft.com/en-us/windows/win32/services/localsystem-account), [Services and redirected drives](https://learn.microsoft.com/en-us/windows/win32/services/services-and-redirected-drives), [Interactive services](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services) |
| PWA e notificações no loopback; Edge e Firefox (2026-09-16) | [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [W3C: Secure Contexts](https://w3c.github.io/webappsec-secure-contexts/), [Edge: supported operating systems](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-supported-operating-systems), [Edge: WebAppInstallForceList](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/webappinstallforcelist), [MDN: Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API), [MDN: showDirectoryPicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker), [Ubuntu noble: firefox](https://packages.ubuntu.com/noble/firefox) |
| Instalador, pacote Linux e assinatura de atualização (2026-09-16) | [NSIS: download](https://nsis.sourceforge.io/Download), [nFPM](https://nfpm.goreleaser.com/), [systemd.exec](https://man7.org/linux/man-pages/man5/systemd.exec.5.html), [minisign](https://jedisct1.github.io/minisign/), [SmartScreen: reputação](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [Artifact Signing: quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart), [SignPath Foundation: termos](https://signpath.org/terms) |
| Better Auth 1.7.3: rate limiter em banco (chave por IP e rota, balde `no-trusted-ip`, IP `127.0.0.1` em teste e desenvolvimento), `getIP` e `ipAddressHeaders`, `disabledPaths` só no router HTTP, plugin `username`, `databaseHooks` e `signUpEmail` com `autoSignIn` (2026-09-16) | Código instalado do pacote lido na sessão: `dist/api/rate-limiter/index.mjs`, `@better-auth/core/dist/utils/ip.mjs`, `dist/api/index.mjs`, `dist/plugins/username/index.mjs`, `dist/api/routes/sign-up.mjs`; [Better Auth: rate limit](https://better-auth.com/docs/concepts/rate-limit), [Better Auth: plugin Username](https://better-auth.com/docs/plugins/username) |
| Better Auth 1.7.3: cookies, origem e rate limit (2026-09-16) | Código instalado do pacote (cookies, middleware de origem e rate limiter) lido na sessão; [Better Auth: cookies](https://better-auth.com/docs/concepts/cookies) |
| TanStack Router 1.170: `Link` marca `aria-current` e a classe `active` quando ativo, `to` só aceita caminho conhecido pelo tipo, `redirect` com `href` e bloqueio de redirect protocol-relative; TanStack Query 5.102: `queryClient.fetchQuery` depreciado em favor de `queryClient.query` (2026-09-16) | Código e tipos instalados dos pacotes lidos na sessão; [TanStack Router: navigation](https://tanstack.com/router/latest/docs/framework/react/guide/navigation), [TanStack Query: QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient) |
| Base UI 1.8: `Checkbox` rotulado por `Field.Label` ou `label` envolvente (2026-09-16) | Documentação empacotada em `@base-ui/react/docs`; [Base UI: Checkbox](https://base-ui.com/react/components/checkbox) |
| Base UI 1.8: `Dialog` e `AlertDialog` controlados por `open` e `onOpenChange`, com `Portal`, `Backdrop`, `Popup`, `Title`, `Description` e `Close`; `Field.Control` com `render` para trocar o `input` por `textarea` (2026-09-17) | Documentação empacotada em `@base-ui/react/docs`; [Base UI: Dialog](https://base-ui.com/react/components/dialog), [Base UI: Alert Dialog](https://base-ui.com/react/components/alert-dialog), [Base UI: Field](https://base-ui.com/react/components/field) |
| oRPC 1.15: erro de validação de entrada responde `BAD_REQUEST` com `data.issues` (2026-09-16) | Código instalado do `@orpc/server` lido na sessão; [oRPC: error handling](https://orpc.dev/docs/error-handling) |
| Tela 03 do Claude Design (recepção de peça: descrição, estado Bom, Com avaria e Desgastada, quantidade, fotos de condição com legenda e câmera, acessórios, devolução prevista) e painel "Peças em custódia" da tela 02, lidos pelo DesignSync (2026-09-17) | [Claude Design: projeto](https://claude.ai/design/p/c40b024b-7619-4657-a87c-ce3ed5285e36) (privado do dono) |
| Tela 04 do Claude Design (orçamento: sub-abas por estado, cabeçalho com código, selo e cliente, tabela Item, Qtd, Desconto, Preço unit. e Total com menu por linha, peça sob medida com a ficha de origem, serviço com peça recebida e 10% de desconto, "Materiais sugeridos pela ficha técnica" com a reserva só na aprovação, totais com desconto por linha e no documento, painel interno com custo estimado, margem desejada, preço sugerido e o alerta de abaixo da meta, e no celular cartões de item com o total), lida da cópia local do arquivo `Costura Pro - Telas.dc.html` (2026-09-24); PDF, aprovação e produto acabado da tela ficaram para as entregas seguintes | [Claude Design: projeto](https://claude.ai/design/p/c40b024b-7619-4657-a87c-ce3ed5285e36) (privado do dono) |
| Tela 05 do Claude Design (OS: cabeçalho com código, "aprovado em" e canal, cliente e subitens; faixa de estados Produção, Entrega e Financeiro e "Revisão comercial"; cartões de subitem com prazo, snapshot de medidas, etapas, consumo, reconciliação e entrega; painéis Recebível, Interno com a margem estimada e a real e Encerramento com os três itens; no celular, selos de produção, entrega e aberto e cartões com o estado), lida da cópia local do arquivo `Costura Pro - Telas.dc.html` (2026-09-24); nesta entrega entraram o cabeçalho, a faixa de estados, os cartões com snapshot, prazo e materiais, o recebível, o painel interno com a margem estimada e o encerramento com os três itens pendentes; etapas, consumo, reconciliação, entrega, pagamento e revisão comercial ficaram para as entregas seguintes | [Claude Design: projeto](https://claude.ai/design/p/c40b024b-7619-4657-a87c-ce3ed5285e36) (privado do dono) |
| Tela 06 do Claude Design (Produção: "Quadro por etapa", "fluxo v4 · 9 trabalhos ativos", "Editar fluxo" e "Nova OP"; colunas Corte, Montagem, Prova, Acabamento e Pronto com contagem; cartões com título, código e subitem, "bloqueado · falta <material>" e prazo vencido; sub-abas Quadro, Calendário, Ordens de produção e Fluxo de produção; no celular, seletor de etapa com contagem e cartões com "Avançar") e o cartão de subitem da tela 05 com a trilha e "Avançar etapa", lidos da cópia local do arquivo `Costura Pro - Telas.dc.html` (md5 `5c540644d13d`, 2026-09-25); nesta entrega entraram o quadro, a trilha, o avanço, a versão do fluxo, a faixa e a sub-aba Fluxo de produção; calendário, OP e consumo ficaram para as entregas seguintes | [Claude Design: projeto](https://claude.ai/design/p/c40b024b-7619-4657-a87c-ce3ed5285e36) (privado do dono) |
| Captura de foto por `input type=file` no iPhone e no Android: `capture`, conversão de HEIC conforme `accept`, EXIF da galeria (2026-09-17) | [WebKit: WKFileUploadPanel.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/forms/WKFileUploadPanel.mm), [WebKit bug 267277](https://bugs.webkit.org/show_bug.cgi?id=267277), [WebKit bug 207088](https://bugs.webkit.org/show_bug.cgi?id=207088), [WebKit: Safari 27 beta](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/), [Apple forum 743049](https://developer.apple.com/forums/thread/743049), [Chromium: SelectFileDialog.java](https://chromium.googlesource.com/chromium/src/+/main/ui/android/java/src/org/chromium/ui/base/SelectFileDialog.java), [caniuse: HEIF](https://caniuse.com/heif) |
| `createImageBitmap` com orientação e redimensionamento, codificação WebP e JPEG pelo canvas (o Safari devolve PNG para WebP) e limites de canvas no iOS (2026-09-17) | [WHATWG: ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html), [WHATWG: canvas serialization](https://html.spec.whatwg.org/multipage/canvas.html), [MDN BCD: HTMLCanvasElement](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/HTMLCanvasElement.json), [WebKit: CanvasBase.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/CanvasBase.cpp), [MDN: ImageBitmap.close](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap/close), [MDN: SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) |
| Assinaturas de JPEG e WebP, tamanho do RIFF, escrita atômica com `fsync` e `rename` no Linux e no Windows (2026-09-17) | [WHATWG: MIME Sniffing](https://mimesniff.spec.whatwg.org/), [RFC 9649: WebP](https://www.rfc-editor.org/rfc/rfc9649.html), [fsync(2)](https://man7.org/linux/man-pages/man2/fsync.2.html), [rename(2)](https://man7.org/linux/man-pages/man2/rename.2.html), [Windows: FILE_RENAME_INFORMATION](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information), [libuv PR 1981](https://github.com/libuv/libuv/pull/1981) |
| Hono `bodyLimit`, resposta de arquivo e cabeçalhos de cache privado, ETag e `nosniff`; oRPC com arquivos em memória; evlog 2.29 com `exclude` por glob de rota (2026-09-17) | [Hono: body limit](https://hono.dev/docs/middleware/builtin/body-limit), [MDN: Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control), [MDN: X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options), [oRPC: binary data](https://orpc.dev/docs/binary-data); tipos do evlog instalado (`middleware-*.d.mts`) lidos na sessão |
| Sanitização de mídia: sobrescrever não garante apagamento em SSD (2026-09-17) | [NIST SP 800-88r2](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-88r2.pdf), [GNU coreutils: shred](https://www.gnu.org/software/coreutils/manual/html_node/shred-invocation.html) |

## 4. Origem das decisões

O projeto foi planejado e iniciado no Linux com Codex e trazido para Windows em 2026-09-16, sem o histórico git anterior. As conversas exportadas foram lidas e apagadas nessa data; o conteúdo durável está no [PRD §9](PRD.md#9-registro-de-decisões), nos ADRs e no [CONTEXT](../CONTEXT.md).

| Data | Sessão | Resultado |
|---|---|---|
| 2026-09-14 | Configuração do Codex | Superpowers e browser-harness instalados; Playwright descartado |
| 2026-09-14 e 2026-09-15 | Brainstorming do produto com perguntas estruturadas | Arquitetura serviço, PWA e Tauri; módulos da v1; direção visual |
| 2026-09-15 | Grill com glossário (a sessão registrou 134 decisões) | OS, OP e venda direta; reservas; custo provisório; cofre por dispositivo; origem canônica; backup com epoch; atualização coordenada; PRD, SPEC, CONTEXT e 5 ADRs |
| 2026-09-15 | Fundação | Scaffold, domínio de preço e reserva, revisão independente |
| 2026-09-15 | Wireframes | 26 telas HTML revisadas (descartadas em 2026-09-16) |
| 2026-09-15 | Harness Codex | Papéis explorer, reviewer e contract; limite de 2 subagentes |
| 2026-09-15 | Tarefa 0A | SQLite nativo com WAL, rejeição de caminho UNC, executor de migrations por Bun |
| 2026-09-16 | Reorganização (Claude Code) | Docs no molde do crm-ia-prd, ROADMAP, harness Claude-first, MCPs e skills enxutos |
| 2026-09-16 | Harness evolutivo (Claude Code) | Hooks de sessão, rules por área, skills de ciclo de entrega, índice de docs com `docs-check`, CI, README bilíngue e licença MIT |
| 2026-09-16 | F0 Mesma origem (Claude Code) | Processo único em loopback, cookie por Host (DEC-56), código sem comentários (DEC-57), Tauri verificado no Windows e Q-11 aberta sobre Tauri, Electron ou serviço com PWA |
| 2026-09-16 | Servidor de acesso e sync (Claude Code) | Grill em cinco rodadas: dono criado no acesso local, allowlist, rate limit e bloqueio remoto, códigos em hash, auditoria append-only, dispositivos com segredo e contrato mínimo de sync (DEC-60 a DEC-64, ADRs 0012 e 0013); regra de nomes sem fase nem spec (DEC-65) |
| 2026-09-16 | Q-11 app desktop (Claude Code) | Sem app desktop: serviço do sistema e acesso local no navegador (DEC-59, ADR 0011); NSSM descartado; wrapper, conta e porta ficam para o S5; pesquisa datada com dois agentes somente leitura |
| 2026-09-16 | F1 Design system (Claude Code) | Paleta verde do Claude Design no lugar do vinho (DEC-07), tema claro único e fontes empacotadas (DEC-66), navegação por uso diário e grupos (DEC-67), catálogo no lugar do Storybook (DEC-68) e telas só com componentes, sem UI nativa nem emoji |
| 2026-09-24 | Implementação por subagente (Claude Code) | Medição das 5 entregas anteriores (compactação em todas; 70% a 80% do tempo de agente gerando texto em esforço max); papel `implementer` com sessão de execução separada da de design (DEC-165) e fim do limite de 2 subagentes somente leitura |

Escolhas iniciais revistas durante o grill, marcadas como "Substituiu" no PRD: item independente por variação virou material base com variantes (DEC-19); baixa de estoque na aprovação virou reserva (DEC-20); "última alteração vence" virou conflito protegido (DEC-41); LAN principal virou origem canônica no Tunnel (DEC-42); sessão lembrada e cache cifrado por PIN viraram cofre com senha forte e PIN de tela (DEC-43); retenção de 7 diários ganhou 12 mensais (DEC-45).

## 5. Harnesses de referência

| Repositório local | O que foi aproveitado |
|---|---|
| `D:\Joseph\Desktop\DEV\crm-ia-prd` | Estrutura de PRD com registro de decisões, ROADMAP com spikes e critério de saída, HARNESS com veredito por artefato, AGENTS.md com regras de escrita e "quando uma decisão muda" |
| `D:\Joseph\Desktop\DEV\takeflow` | Hooks como módulos testáveis (`guard`, `format`, `touch`, `stop-check` em fases, baseline da sessão), rules com `paths:`, papéis somente leitura e checagem de portas geradas |
| `D:\Joseph\Desktop\DEV\newticket-go` | Canal de conhecimento novo destilado para os papéis, checagem de referências dos agents, template de spec com DoD e mutações morre e sobrevive, rota enxuta e completa |
| `onflux-tech/vsftpd-manager` (GitHub) | Padrão do README público: badges, frase-resumo, seções EN/PT com índice e licença MIT |

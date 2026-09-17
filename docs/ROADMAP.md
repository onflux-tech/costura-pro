# Roadmap: Costura Pro v1

| Campo | Valor |
|---|---|
| Status | Derivado das 5 fases aprovadas pelo dono em 2026-09-15 e reorganizado em 2026-09-16 (ver [Mudanças em relação ao plano de 2026-09-15](#mudanças-em-relação-ao-plano-de-2026-09-15)) |
| Produto | [PRD.md](PRD.md) |
| Contratos | [SPEC.md](SPEC.md) (estado atual na §0) |
| Horizonte | Sem datas: projeto de um dono com agentes de IA. Cada fase só termina quando o critério de saída tem evidência |

## Premissas

- **Um desenvolvedor com agentes de IA.** Claude Code é a ferramenta padrão; Codex e clientes genéricos usam as portas geradas ([HARNESS](HARNESS.md)).
- **v1 completa só no aceite.** As fases são entregas internas; nenhuma delas é chamada de v1 ([DEC-02](PRD.md#91-produto-e-escopo)).
- **Todo agregado nasce pronto para sync.** Desde a F3, cada registro tem UUID, `version` e comandos idempotentes por `opId`, mesmo antes do espelho offline da F6. Isso evita reescrever os agregados depois.
- **Sem dados reais antes do backup.** O backup diário chega na F7. Se o dono quiser usar o sistema com dados reais antes, RF-OPE-01 a 04 sobem de fase.
- **Tunnel fechado até a F2.** Nada é exposto pela Cloudflare antes do cadastro público estar fechado no servidor.
- **Plano detalhado por fase.** No início de cada fase nasce uma spec e um plano locais (fora do git); o porquê durável vai para ADR, PRD e SPEC.

## Visão geral

```mermaid
flowchart LR
  F0[F0 Fundação] --> F1[F1 Design system]
  F1 --> F2[F2 Onboarding e acesso]
  F2 --> F3[F3 Atendimento, catálogo e estoque]
  F3 --> F4[F4 Comercial e documentos]
  F4 --> F5[F5 Produção, venda e finanças]
  F5 --> F6[F6 Offline integral]
  F6 --> F7[F7 Operação]
  F7 --> V1{{Aceite v1}}
```

A parte de servidor da F2 (schema, autenticação e contrato de sync) pode começar durante a F1; as telas da F2 esperam o design system.

### Mudanças em relação ao plano de 2026-09-15

O plano aprovado tinha 5 fases: (1) documentos, scaffold, onboarding, autenticação, dispositivos e base de sync; (2) clientes, catálogos, locais, compras, inventário e reservas; (3) orçamentos e PDFs, OS por subitem, custódia, agenda e entrega; (4) OP, acabados, venda e devolução, contas, custos e relatórios; (5) offline integral, conflitos, restauração, serviços, instaladores e atualização. Em 2026-09-16:

- entrou a F1 (design system e Storybook), no lugar dos wireframes descartados;
- a fase 5 virou F6 (offline) e F7 (operação);
- reservas foram para a F4, porque nascem na aprovação da OS;
- contas financeiras foram para a F3, porque a compra é paga numa conta ou vira obrigação;
- recebíveis e pagamentos básicos foram para a F4, porque o encerramento da OS depende do financeiro;
- a sandbox foi para a F5, porque demonstra OS, OP e venda.

| Fase | Objetivo | Critério de aceitação que fecha |
|---|---|---|
| F0 | Base executável e verificável em Windows e Ubuntu | Checks verdes e mesma origem |
| F1 | Linguagem visual e componentes antes das telas reais | Catálogo com componentes base |
| F2 | Dono único, wizard e contrato mínimo de sync | Cadastro fechado e sync idempotente provados |
| F3 | Clientes, peças recebidas, catálogo, estoque e compras | CA-03 parcial |
| F4 | Orçamento, OS, reservas, documentos e agenda | CA-02, CA-03, CA-04, CA-06 online |
| F5 | OP, venda direta, finanças, relatórios e sandbox | CA-01, CA-05 |
| F6 | Cofre, espelho, conflitos e exportação no celular | CA-06 offline, CA-07, CA-08 |
| F7 | Backup, restauração, serviços, Tunnel, instaladores e atualização | CA-09, CA-11 |
| Aceite | Todas as jornadas em todas as plataformas | CA-01 a CA-12 |

## Spikes

Cada spike responde uma pergunta que muda o desenho antes de construir em cima dela. O resultado vira decisão registrada em [REFERENCIAS](REFERENCIAS.md) e, se for de mão única, ADR.

| Spike | Pergunta | Critério de saída | Antes de |
|---|---|---|---|
| S1. PDF no navegador | Qual biblioteca gera A4 e 80 mm com fontes embutidas igual em Chrome Android, Safari iPhone e desktop? | O mesmo template gera PDF válido nas três plataformas, com acentuação correta e fonte embutida; tempo de emissão medido; bytes e hash guardados sem regeneração (resolve Q-03) | F4 |
| S2. Cofre cifrado | PBKDF2 com AES-GCM sobre Dexie é rápido o bastante num celular de referência? | Parâmetros de derivação por plataforma registrados; tempo de desbloqueio e de gravação medidos com volume de referência definido no spike; nonce e AAD cobertos por teste (resolve parte de Q-05) | F6 |
| S3. Câmera e códigos | Como ler QR e código de barras em Safari iPhone e Chrome Android? | Lê o QR da etiqueta de custódia e um EAN impresso nas duas plataformas; biblioteca escolhida; código curto digitável como alternativa (resolve Q-04) | F3 |
| S4. Retenção da PWA | Como se comportam persistência, quota e eviction na PWA instalada no iPhone e no Android? | Comportamento documentado por plataforma; exportação e importação da outbox provadas numa nova instalação (resolve parte de Q-05) | F6 |
| S5. Serviço no sistema | Como rodar o servidor Bun compilado como serviço no Windows e com `systemd` no Ubuntu? | Sobe no boot sem login, grava em ProgramData com herança cortada (só SYSTEM, Administradores e a conta do serviço) ou em `/var/lib/costura-pro` e sobrevive a reinício; wrapper escolhido entre shawl e WinSW 2.12 NET461 rodando como serviço real na sessão 0, com desligamento limpo por Ctrl+C medido contra o tempo de parada do wrapper; conta do serviço (conta virtual primeiro, LocalSystem só com motivo) gravando backup em pendrive NTFS e exFAT, pasta do OneDrive e caminho UNC; unit `systemd` gravando backup em mídia montada para o dono; porta definitiva da origem local; atalho do Edge em modo app no Windows e `.desktop` com Chrome ou Chromium no Ubuntu abrindo o acesso local (resolve parte de Q-06; a Q-11 foi resolvida pela DEC-59) | F7 |
| S6. Atualização coordenada | Um supervisor consegue trocar binários, migrar, checar saúde e reverter tudo? | Falha simulada em cada etapa volta à versão anterior com banco íntegro e nenhuma operação aceita perdida; o supervisor roda fora do processo do servidor e recusa artefato sem assinatura minisign válida (resolve parte de Q-06) | F7 |

## F0: Fundação

**Objetivo:** base executável e verificável nos dois sistemas operacionais, sem regra de negócio além das já testadas.

**Concluído:**
- Scaffold Better-T-Stack 3.43.1 (2026-09-15).
- `suggestPrice` e `planReservation` com testes (2026-09-15).
- SQLite nativo em WAL, validação de caminho local (inclusive UNC) e migrations por Bun ([ADR 0006](adr/0006-sqlite-nativo-bun.md), 2026-09-15).
- Harness de agentes com portas geradas e documentação reorganizada (2026-09-16).
- `closeDb` libera o arquivo do banco no Windows; testes de banco verdes no Windows (2026-09-16).
- pnpm 11.20.0 global e telemetria do varlock desligada: `pnpm install`, testes, `check-types` e `build` verdes no Windows (2026-09-16).
- Repositório público no GitHub com licença MIT; hooks de sessão, rules por área, skills de ciclo de entrega, índice de docs com `docs-check` e CI em Ubuntu 24.04 e Windows (2026-09-16).
- CI verde na `main` em Ubuntu 24.04 e Windows, com install a partir de clone limpo (2026-09-16).
- Ambiente Windows: `apps/server/.env` com `DATABASE_FILE` absoluto no lugar do legado `DATABASE_URL`, migrations aplicadas e servidor respondendo em localhost (2026-09-16).
- Mesma origem (2026-09-16):
  - processo único em `127.0.0.1:3000` servindo SPA, assets, `/api/auth` e `/rpc`, com teste automatizado do build real (fallback, cache, `/rpc`, `/api/auth`, denylist do service worker e tabela de sockets do sistema);
  - cliente relativo, proxy do Vite e allowlist de Host e Origin;
  - cookie `costura-pro.session_token` sem `Secure` no loopback e com `Secure` no Host canônico;
  - verificado em navegador real (dev e produção, desktop e 320 px), no `tauri dev` e no executável de release do Tauri no Windows.
- Bundle web sem aviso de chunk acima de 500 kB: devtools só em desenvolvimento e React num chunk próprio, com as rotas já divididas (2026-09-16).
- App Tauri removido do scaffold (Q-11, DEC-59): pasta do app, scripts e CLI do Tauri, teste do `frontendDist` (o contrato do proxy do Vite segue em `apps/server/tests/vite-proxy.test.ts`), armadilhas do HARNESS e da rule de web, papel `contract` e instruções de desenvolvimento do README (2026-09-16).

**Pendente:**
- **Build conferido numa máquina Ubuntu 24.04** além do CI (Q-10).
- **CI por caminho:** push só de docs e markdown roda `harness:check`, `docs:check` e `harness:test`; lint, tipos, testes e build só quando o intervalo do push toca algo fora de `docs/**`, `*.md` e `.claude/rules/**`, e push forçado roda tudo.

**Critério de saída:**
- `pnpm test`, `pnpm check-types`, `pnpm check`, `pnpm build` e `pnpm harness:check` verdes no Windows e no Ubuntu.
- Build de produção servido por um único processo em loopback, com teste automatizado de SPA fallback e das rotas `/api` e `/rpc`.
- CI verde no push da `main` em Ubuntu 24.04 e Windows.

## F1: Design system

**Objetivo:** definir a linguagem visual antes das telas reais. Os wireframes HTML foram descartados em 2026-09-16 ([DEC-52](PRD.md#97-engenharia-e-processo)).

**Entregas:**
- **Identidade "ateliê contemporâneo"** (RNF-09) desenhada com Claude Design: paleta, tipografia, espaçamento, raios, estados e 12 telas de referência em 1440 e 390 px.
- **Tokens em `packages/ui`** e componentes base:
  - texto, botão, campo, grupo de escolha, cartão e lista que vira cartão no celular;
  - navegação horizontal com grupos no desktop e barra inferior no celular;
  - badge de estado de produção, entrega e financeiro;
  - alerta, métrica, medidor, trilha de etapas, checklist e indicador de conexão e sync.
- **Catálogo `/catalogo`** só em desenvolvimento, com os estados dos componentes, no lugar do Storybook ([DEC-68](PRD.md#97-engenharia-e-processo)).

**Concluído:**
- Design system (2026-09-16), descrito em [docs/areas/design-system.md](areas/design-system.md):
  - tokens em hexadecimal com teste de contraste AA, fontes empacotadas e sem tema escuro;
  - componentes base e de navegação no `packages/ui`, com os 13 destinos agrupados por uso ([DEC-67](PRD.md#91-produto-e-escopo));
  - `apps/web` só com tokens e componentes, travado por teste contra cor solta, elemento nativo, diálogo do navegador e emoji;
  - cabeçalho, início, painel e login no desenho novo; devtools fora do build de produção;
  - verificado em navegador real em 320, 390, 768, 1024, 1280 e 1440 px, por teclado e toque, em desenvolvimento e produção.

**Pendente:**
- Documentos A4 e 80 mm e as telas de negócio seguem o Claude Design em cada fase (F3 a F7).
- Nome comercial e logo (Q-01).

**Critério de saída:**
- Catálogo roda localmente com componentes base e seus estados.
- Contraste AA e foco visível conferidos em navegador real em 320 e 1440 px.
- `apps/web` consome os tokens, sem cor ou espaçamento soltos.

## F2: Onboarding, acesso e dispositivo

**Objetivo:** substituir o login genérico do scaffold por um único dono, wizard obrigatório e o contrato mínimo de dispositivos e sync.

**Requisitos:** RF-ENT-02, 03, 05, 06; RF-ACE-01, 02, 03 (códigos de recuperação); RF-ACE-04 (aprovação de dispositivo).

**Entregas:**
- **Schema de instalação:** registro singleton da instalação, códigos de recuperação só como hash, auditoria mínima e rate limit persistido.
- **Dono único com username e senha:**
  - cadastro público rejeitado no servidor, inclusive por API direta e em tentativas concorrentes;
  - 5 tentativas por 60 s em `/sign-in/username`, persistidas;
  - cookie compatível com cada origem.
- **Wizard retomável:** identidade, conta, códigos e pasta de backup escolhida no navegador de pastas do servidor, só no acesso local, e testada; checklist de continuidade.
- **Shell de navegação** com o design system.
- **Contrato mínimo de sync:** dispositivos aprovados e revogados, operações únicas por `opId`, log de mudanças por cursor, conflito e quarentena; `push`, `pull` e `resolve` limitados à instalação e aos dispositivos.

**Concluído:**
- Servidor da F2 (2026-09-16), com testes em SQLite real e Hono autenticado:
  - instalação singleton com wizard de servidor (estados, navegador de pastas e teste de gravação da pasta de backup);
  - dono único criado só no acesso local, allowlist de rotas do Better Auth, rate limit persistido e bloqueio remoto progressivo ([ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md));
  - códigos de recuperação em hash, reset de senha só local e auditoria append-only;
  - dispositivos com segredo, aprovação direta e código de ativação, e contrato mínimo de sync com `push`, `pull`, `resolve` e `pending`, quarentena por item e resultado de cada comando gravado na transação do efeito ([ADR 0013](adr/0013-contrato-minimo-de-sincronizacao.md));
  - login web mínimo por username verificado em navegador real a 1440 e 320 px.

**Pendente:**
- Telas do wizard e shell de navegação sobre o design system da F1 ([docs/areas/design-system.md](areas/design-system.md)).
- Dashboard redirecionando ao passo pendente do wizard (o servidor já responde `PRECONDITION_FAILED` com o estado).
- Wizard verificado em navegador real no desktop e em 320 px; só então o Tunnel pode ser exposto (Q-09).

**Critério de saída:**
- Testes com SQLite real provam:
  - segundo cadastro rejeitado (inclusive concorrente e por API);
  - rate limit que persiste após reinício;
  - códigos guardados só como hash;
  - dashboard bloqueado até a pasta de backup ser testada;
  - `opId` repetido devolve o mesmo resultado;
  - versão-base errada vira conflito;
  - epoch antigo vai para quarentena.
- Login e wizard verificados em navegador real no desktop e em 320 px.
- Só depois disso o Tunnel pode ser exposto (Q-09).

## F3: Atendimento, catálogo e estoque

**Objetivo:** cadastros e estoque físico com movimentos imutáveis.

**Requisitos:** RF-ATD-01 a 03, 05 a 07; RF-CAT-01 a 12; RF-EST-01 a 06, 13, 14; RF-FIN-01; RF-ENT-08; RF-ACE-14 (captura e otimização de fotos).

**Entregas:**
- Clientes, perfis, modelos de medidas, arquivamento, anonimização e recepção de peças com fotos.
- Serviços, materiais e produtos com variantes, fichas técnicas, galeria e preço sugerido.
- Locais, lotes, transferências, compras com fornecedor e conversão, rateio de frete e desconto, obrigação de compra e contas financeiras.
- Sessão de inventário, ajuste rápido e saldos de abertura.
- Etiquetas e leitura por câmera, conforme o S3.
- Busca global sobre clientes, catálogo e estoque.

**Critério de saída:**
- Parte de cadastro de estoque do CA-03 com teste de integração: variantes, local, lote, compra em embalagem, conversão e custo de aquisição com frete e desconto.
- Arquivar e anonimizar cliente respeitando trabalho e saldo abertos.
- Jornadas de cadastro verificadas em navegador real no desktop e em 320 px.

## F4: Comercial, documentos e agenda

**Objetivo:** fechar a jornada cliente, orçamento, aprovação, OS, consumo, entrega e recebimento.

**Requisitos:** RF-COM-01 a 10; RF-CAT-13 a 15; RF-EST-07 a 12, 15; RF-PRO-01 a 03; RF-DOC-01 a 03, 05; RF-ATD-04, 08 a 12; RF-FIN-02, 03; RF-ENT-10.

**Entregas:**
- Orçamento com revisões, aceite parcial, desconto e alertas de margem.
- Aprovação transacional que cria OS, subitens, snapshot de medidas, reservas, pendências e recebível.
- Estados separados de produção, entrega e financeiro.
- Lista de compras consolidada.
- Consumo com lote sugerido, troca de material, reconciliação, saldo negativo com custo provisório e ajuste.
- Fluxo de produção versionado com quadro por etapa.
- Entrega parcial e liquidação de cancelamento.
- Recebíveis, pagamentos e alocação.
- Documentos PDF congelados (conforme o S1), comprovante de recepção e etiqueta de custódia.
- Agenda com compromissos, prazos, capacidade diária e mensagem preparada.

**Critério de saída:**
- CA-02, CA-03 e CA-04 completos.
- CA-06 no desktop com conexão.
- Idempotência da aprovação provada por teste de repetição.

## F5: Produção interna, venda direta e finanças

**Objetivo:** estoque de acabados, venda de pronto e visão financeira completa.

**Requisitos:** RF-PRO-04 a 08; RF-COM-11 a 14; RF-FIN-04 a 15; RF-ENT-04, 07, 09.

**Entregas:**
- **Produção:** OP com unidades boas, perdas, saídas parciais e custo médio por variante.
- **Venda:** venda direta, atendimento vinculado, devolução com custo congelado e exceção de sobre-venda no servidor.
- **Finanças:**
  - cartão com taxa e conta de liquidação;
  - receitas e despesas avulsas, despesas diretas, obrigações recorrentes, aporte e retirada;
  - conferência de caixa;
  - relatórios de competência e caixa em PDF.
- **Tela inicial:** Hoje completa e ações rápidas.
- **Sandbox de demonstração.**

**Critério de saída:**
- CA-01 e CA-05 completos.
- Faturamento sem dupla contagem em revisão, cancelamento e devolução, provado por teste.

## F6: Offline integral

**Objetivo:** o celular executa todos os fluxos operacionais sem internet e sincroniza sem perder nem duplicar.

**Requisitos:** RF-ACE-04 (espelho completo), 05 a 13, 14 (cache offline de imagens); RF-DOC-04; RF-COM-14 (cenário offline).

**Entregas:**
- Cofre com senha forte e PIN, espelho Dexie cifrado e outbox (conforme S2 e S4).
- Emissão de PDF e captura de fotos offline.
- Rebase e migração local.
- Caixa de conflitos, exceções e quarentena na interface.
- Exportação e importação da outbox.
- Assistente de instalação no iPhone, indicador de sync e avisos de quota.

**Critério de saída:**
- CA-06 offline, CA-07 e CA-08 completos.
- Meta de sync do RNF-05 medida num celular de referência.

## F7: Operação

**Objetivo:** instalar, proteger, restaurar e atualizar sem terminal.

**Requisitos:** RF-OPE-01 a 08; RF-ENT-01; RF-ACE-03 (resgate físico).

**Entregas:**
- **Backup e restauração:** backup diário com retenção, restauração com pré-backup e novo epoch.
- **Serviços e instaladores:** servidor e `cloudflared` como serviços (conforme S5); instalador NSIS por máquina no Windows e `.deb` no Ubuntu, com atalho que abre o acesso local no navegador.
- **Tunnel:** assistente com token do tunnel remotamente gerenciado.
- **Atualização coordenada** (conforme S6), com releases assinados em minisign no GitHub e o supervisor como único canal.
- **Diagnóstico e resgate físico.**
- **Identidade da instalação:** nome do serviço e do atalho, guarda da chave minisign e avaliação da SignPath Foundation para assinar os executáveis (Q-08).

**Critério de saída:**
- CA-09 e CA-11 completos.
- Instalação limpa em Windows e Ubuntu sem terminal.
- Restauração a partir de backup real testada.

## Aceite da v1

- CA-01 a CA-12 com evidência registrada em Windows, Ubuntu 24.04, Chrome Android e Safari iPhone.
- RNF-05 medido no PC do ateliê e num celular de referência.
- Questões em aberto do PRD resolvidas ou explicitamente adiadas pelo dono.

Só então a versão é chamada de v1.

## Rastreio de requisitos por fase

| Área | F2 | F3 | F4 | F5 | F6 | F7 |
|---|---|---|---|---|---|---|
| RF-ENT | 02, 03, 05, 06 | 08 | 10 | 04, 07, 09 | | 01 |
| RF-ATD | | 01 a 03, 05 a 07 | 04, 08 a 12 | | | |
| RF-CAT | | 01 a 12 | 13 a 15 | | | |
| RF-EST | | 01 a 06, 13, 14 | 07 a 12, 15 | | | |
| RF-PRO | | | 01 a 03 | 04 a 08 | | |
| RF-COM | | | 01 a 10 | 11 a 14 | 14 (offline) | |
| RF-DOC | | | 01 a 03, 05 | | 04 | |
| RF-FIN | | 01 | 02, 03 | 04 a 15 | | |
| RF-ACE | 01 a 03, 04 (aprovação) | 14 (captura) | | | 04 (espelho), 05 a 14 | 03 (resgate físico) |
| RF-OPE | | | | | | 01 a 08 |

## Invariantes que nunca se cortam

- Idempotência por `opId` e versão-base em todo comando que muda estado.
- Movimentos de estoque e finanças e documentos emitidos nunca são editados nem apagados.
- Dinheiro e quantidade sempre inteiros.
- Nenhuma operação confirmada é descartada; fatos concorrentes viram exceção visível.
- Cadastro público fechado antes de qualquer exposição pelo Tunnel.
- Backup com restauração testada antes de dados reais.
- Custos internos nunca aparecem ao cliente.

## Definição de pronto de cada entrega

- **Testes:** TDD para regra e comportamento novos, com testes relevantes verdes. Domínio roda em `bun test`; integração usa SQLite real em diretório temporário.
- **Checks zerados:** `pnpm check-types`, `pnpm check` e `pnpm build` sem erro nem aviso; `pnpm harness:check` quando o harness for tocado.
- **Interface:** verificada em navegador real com browser-harness, em 320 px e no desktop, por toque e teclado.
- **Migrations:**
  - só para a frente;
  - geradas por `drizzle-kit`, revisadas e aplicadas pelo executor Bun;
  - `db:push` nunca roda em dados reais.
- **Docs na mesma mudança:** PRD, SPEC (inclusive a §0), CONTEXT e ADR mudam junto quando a regra, o contrato ou o termo mudam.
- **Logs:** sem dados sensíveis.

## Dependências críticas

| Dependência | Bloqueia |
|---|---|
| F1 (design system) | Telas da F2 em diante |
| Contrato mínimo de sync da F2 | Agregados da F3 a F5 |
| S3 | Etiquetas e leitura por câmera na F3 |
| S1 | Documentos da F4 |
| S2 e S4 | Cofre e espelho da F6 |
| S5 e S6 | Instalador e atualização da F7 |
| Domínio do dono na Cloudflare (Q-09) | Uso móvel real e testes em aparelho |
| Aparelhos de validação (Q-10) | S1, S3, saída da F0 (Ubuntu), F6 e aceite |
| Repositório remoto (Q-07) | CI e releases da F7 |

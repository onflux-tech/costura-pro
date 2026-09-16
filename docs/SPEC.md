# SPEC: Costura Pro v1

| Campo | Valor |
|---|---|
| Autoridade | O [PRD](PRD.md) define comportamento; [CONTEXT](../CONTEXT.md) define nomes; os [ADRs](adr/) justificam fronteiras difíceis. Esta SPEC define os contratos mínimos para implementar a v1 |
| Estado | Contratos alvo da v1. O que já existe no código está na [§0](#0-estado-de-implementação); o restante é previsto e segue a ordem do [ROADMAP](ROADMAP.md) |
| Última revisão | 2026-09-16 |

Não é formato fiscal. Quando um contrato muda, atualize esta SPEC, a linha correspondente da §0 e, se a decisão for de mão única, o ADR.

## 0. Estado de implementação

| Contrato | Estado | Onde está hoje | Fase |
|---|---|---|---|
| Monorepo e PWA básica gerados pelo scaffold, sem app desktop (DEC-59) | Implementado | `apps/web`, `apps/server`, `packages/*` | F0 |
| Preço sugerido com margem sobre a venda | Implementado como função pura testada | `packages/domain/src/pricing.ts` | F0 |
| Reserva com pendência sem inventar saldo | Implementado como função pura testada | `packages/domain/src/reservation.ts` | F0 |
| SQLite nativo em WAL, validação de caminho local, migrations por Bun | Implementado | `packages/db/src/index.ts`, `packages/db/src/migrate.ts`, `packages/db/tests/native-sqlite.test.ts` | F0 |
| Schema de autenticação, instalação, auditoria e sync | Implementado: tabelas do Better Auth com `username` e `rate_limit`, instalação singleton, guarda de login, códigos de recuperação, auditoria e log de mudanças append-only, dispositivos, códigos de ativação, operações e conflitos | `packages/db/src/schema/`, migrations `0000` a `0002`, `packages/db/tests/installation-sync-schema.test.ts` | F2 |
| Mesma origem: Hono serve SPA e API só em loopback | Implementado: processo único em `127.0.0.1:3000`, allowlist de Host e Origin, cookie `Secure` por Host canônico, cliente relativo e proxy do Vite para o loopback | `apps/server/src/app.ts`, `apps/server/src/origin.ts`, `apps/server/src/web.ts`, `apps/server/src/index.ts`, `apps/web/src/utils/orpc.ts`, `apps/web/vite.config.ts`, `apps/server/tests/` | F0 |
| Logs estruturados | Parcial: evlog no servidor, drain em arquivo fora de produção | `apps/server/src/index.ts` | F0 a F7 |
| Dono único, username, rate limit persistido, bloqueio remoto, códigos de recuperação, auditoria | Implementado no servidor; login web mínimo por username | `packages/auth/src/index.ts`, `apps/server/src/auth-routes.ts`, `apps/server/src/access.ts`, `packages/api/src/sign-in-guard.ts`, `packages/api/src/installation/`, `packages/api/src/recovery/`, `packages/api/src/audit.ts`, `apps/web/src/components/sign-in-form.tsx`, `apps/server/tests/access.test.ts`, `sign-in.test.ts`, `installation.test.ts` | F2 |
| Wizard inicial e sandbox | Parcial: estados, comandos, navegador de pastas e teste de gravação no servidor; telas e sandbox previstas | `packages/api/src/installation/` | F2 (telas depois do design system), F5 (sandbox) |
| Acesso local, navegador de pastas e atalhos do instalador | Parcial: acesso local e navegador de pastas implementados; atalhos previstos | `apps/server/src/access.ts`, `packages/api/src/index.ts`, `packages/api/src/installation/backup-folder.ts` | F2 (acesso local e pasta de backup), F7 (instalador e atalhos) |
| Dispositivos, epoch, `push`, `pull`, `resolve` | Parcial: contrato mínimo implementado (dispositivos com segredo, código de ativação, operação por `opId`, log por cursor, conflito, quarentena, `rebase`); espelho completo previsto | `packages/api/src/devices/`, `packages/api/src/sync/`, `packages/api/src/operations.ts`, `apps/server/tests/devices.test.ts`, `sync.test.ts` | F2 (contrato mínimo), F6 (espelho completo) |
| Agregados de atendimento, catálogo e estoque | Previsto | | F3 |
| Orçamento, OS, documentos PDF, agenda e custódia | Previsto | | F4 |
| OP, venda direta, finanças e relatórios | Previsto | | F5 |
| Cofre offline, Dexie, outbox, conflitos e exportação | Previsto | | F6 |
| Backup, restauração, serviços, instaladores, Tunnel e atualização | Previsto (apenas `VACUUM INTO` provado em teste) | | F7 |

## 1. Topologia e componentes

**Estado:** parcial (§0).

O monorepo parte do Better-T-Stack 3.43.1 (comando reproduzível em `bts.jsonc`):

| Caminho | Papel |
|---|---|
| `apps/web` | SPA React com TanStack Router, Vite e PWA; interface compartilhada pelo navegador do PC e pelo celular |
| `apps/server` | Hono com oRPC, Better Auth e evlog, executado por Bun |
| `packages/api` | Roteadores oRPC e contexto |
| `packages/auth` | Configuração do Better Auth |
| `packages/db` | Schema Drizzle, migrations e acesso SQLite |
| `packages/domain` | Regras puras de domínio (dinheiro, quantidade, preço, reserva) |
| `packages/ui` | Componentes shadcn/ui e estilos compartilhados |
| `packages/config` | `tsconfig` base |

A UI usa caminhos relativos (`/rpc`, `/api`) em todas as origens. Em produção, o Hono serve SPA, assets e API num único processo ligado apenas a `127.0.0.1`; o PC abre a interface nesse loopback pelo navegador e o `cloudflared` encaminha o subdomínio público ao mesmo endereço. Nenhuma porta HTTP é exposta na LAN ([ADR 0001](adr/0001-origem-canonica-e-local-first.md)).

**Mesma origem (F0):**

- **Processo único.** `pnpm --filter server start` roda `bun --env-file=production.env dist/index.mjs`; com `NODE_ENV=production` o Hono serve a SPA de `apps/web/dist`, e fora de produção só a API. Escuta `hostname: "127.0.0.1"` na `PORT` do schema. A `PORT` fica em 3000, a mesma do alvo do proxy do Vite (conferido por teste), até o S5 decidir a porta definitiva, que depois nunca muda porque faz parte da origem local. `NODE_ENV` já presente no ambiente vence o `--env-file`. O script `compile` (binário do Bun) ainda não segue este contrato: sem `NODE_ENV=production` e com `import.meta.dirname` virtual, fica para a F7.
- **Rotas.** Ordem: evlog, guarda de Host e Origin, `Secure` por Host, guarda de login em `/api/auth/sign-in/username` (§5), `/api/auth/*` (allowlist do Better Auth, §5), `/rpc/*` e `/api-reference/*` (oRPC, com as mesmas regras de acesso), estáticos e fallback. `/assets/*` sai com `Cache-Control: public, max-age=31536000, immutable` e asset ausente responde 404; o resto da SPA sai com `no-cache`. GET fora de `/api`, `/api-reference` e `/rpc` sem arquivo correspondente responde `index.html`; `/api` e `/rpc` desconhecidos respondem 404 sem HTML. Sem `index.html`, o servidor não sobe: `Instalação incompleta: build da web não encontrado em <dir>. Rode pnpm build.`
- **Host e Origin.** Host permitido: `127.0.0.1` e `localhost` em qualquer porta, e o host de `CANONICAL_ORIGIN` (variável opcional do servidor, só `https` sem caminho, o único lugar da origem canônica). Origin, quando presente, precisa ser igual à origem esperada para o Host (`http://<host>` no loopback, `CANONICAL_ORIGIN` no host canônico). Fora disso, 403 `Host não permitido` ou `Origem não permitida`. O CORS saiu.
- **Cliente.** oRPC em `new URL("/rpc", window.location.origin)` e `createAuthClient()` sem `baseURL`. Em desenvolvimento, o Vite (`localhost:3001`) faz proxy de `^/(api|rpc|api-reference)(/|$)` para `http://127.0.0.1:3000` com `changeOrigin: false`, então Host e Origin chegam coerentes. O service worker nega o fallback de navegação para `/api`, `/api-reference` e `/rpc`.
- HTTPS público é responsabilidade do Tunnel; a porta local não promete TLS, e o token do `cloudflared` nunca vai para o cliente nem para variável pública.

**Acesso local** (regra implementada na F2, atalhos na F7; DEC-59, [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md)). O PC usa a interface no navegador pela origem local `http://127.0.0.1:<PORT>`, sem app desktop. No Windows o instalador cria atalho para `msedge.exe --app=http://127.0.0.1:<PORT>/`, com o navegador padrão quando não houver Edge; no Ubuntu um `.desktop` abre Google Chrome ou Chromium com `--app` e usa `xdg-open` quando não houver nenhum. A origem local é a identidade da interface no PC (cookie, service worker e cache), então a porta definitiva sai do S5 e nunca muda. Uma requisição é do acesso local quando o Host é de loopback (`127.0.0.1` ou `localhost`) e não traz `cf-connecting-ip`, nunca pelo IP do socket, porque o `cloudflared` também conecta pelo loopback. Ações administrativas exigem isso e a sessão do dono, com três exceções sem sessão, todas só no acesso local: `installation.setAtelierName` enquanto a instalação está em `empty` ou `atelier`, `installation.createOwner` no passo `atelier` e `recovery.resetPassword`, em que o código de recuperação é a credencial (§5).

SQLite em WAL é a fonte autoritativa única, aberta por Drizzle sobre `bun:sqlite`, e um processo servidor controla gravações e transações ([ADR 0006](adr/0006-sqlite-nativo-bun.md)). Banco e mídia ficam fora do diretório de instalação: `%PROGRAMDATA%\CosturaPro\data` no Windows e `/var/lib/costura-pro` no Linux. Configuração e segredos usam permissões do sistema operacional. O instalador configura o servidor como serviço ativo no boot, pelo wrapper escolhido no S5, o atalho do acesso local e o `cloudflared` como serviço opcional após receber o token ([ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md)). Sem internet, o PC segue no loopback; a PWA já carregada opera pelo service worker e IndexedDB e não sincroniza até o Tunnel voltar.

Não usar addon de billing, SaaS ou fiscal. Harness de agentes, MCPs e skills estão em [HARNESS](HARNESS.md).

## 2. Persistência, valores e fronteiras de domínio

**Estado:** persistência e valores parciais; agregados previstos (§0).

**Identidade e códigos** ([ADR 0009](adr/0009-uuid-e-codigo-documental-por-dispositivo.md)). Identidades são UUIDv4 gerados por `crypto.randomUUID()` no dispositivo. Códigos humanos permanentes usam tipo, ano local, sigla do dispositivo e contador local, sem sequência global (`ORC-2026-CEL-0042`). Código não é chave primária.

**Dinheiro e quantidade** ([ADR 0010](adr/0010-dinheiro-e-quantidade-inteiros.md)). Valores monetários são inteiros de centavos com sinal (`bigint` no domínio, string decimal no JSON), sem `float`. Quantidades são inteiros de milionésimos da unidade base (`quantityMicros`, `bigint` ou string no JSON); cada variante declara precisão exibida de 0 a 6 casas e cada compra declara fator de conversão racional positivo. Arredondamento monetário ao centavo, meio para cima; resíduos de rateio ficam na última linha ou lote para conservar o total.

**Banco.** `DATABASE_FILE` é caminho absoluto local; URL remota, `:memory:`, caminho relativo e caminho UNC são rejeitados. `drizzle-kit` só gera SQL; migrations rodam pelo executor Bun (`pnpm db:migrate`). `db:push` nunca roda contra banco com dados reais.

**Agregados e movimentos.** Agregados com `version` monotônica: Cliente e Perfil, Catálogos e versões de ficha, Orçamento e Revisão, OS e Subitem, OP, Venda e Devolução, Compromisso e Documento. Tabelas separadas de movimentos imutáveis guardam estoque (abertura, compra, reserva e liberação, consumo, retorno, transferência, inventário, produção, venda, devolução, perda), custos (estimativa, real, ajuste), recebíveis e parcelas, pagamentos e alocações, contas e transferências, despesas e obrigações e auditoria. Projeções de saldo podem ser mantidas na mesma transação para consulta rápida, mas movimentos e documentos emitidos nunca são editados ou apagados ([ADR 0003](adr/0003-movimentos-imutaveis-e-custo-provisorio.md)). Exclusão de cliente é arquivamento ou anonimização autorizada, nunca cascata destrutiva.

**Estoque e custo.** Uma aquisição aumenta quantidade e valor de material por lote; frete e desconto são alocados proporcionalmente ao valor bruto dos itens, com resíduo conservado. Reserva diminui somente disponibilidade e é recalculada por revisão ou cancelamento. Consumo pode levar o físico a negativo; usa custo provisório baseado no último custo conhecido ou informado, cria pendência e, quando uma aquisição cobre o déficit, registra ajuste de custo referenciando o consumo original. Seleção de lote sugere o mais antigo, mas permite escolha e divisão explícitas. Produto acabado usa valor e quantidade por variante para média ponderada; venda congela o custo das unidades baixadas. Retorno vendável reverte esse custo, não a média atual. OP distribui o custo total real ou ajustado entre unidades boas; saídas parciais usam custo provisório e ajuste ao fechar.

**Preço e margem.** Serviço guarda custo interno fixo separado do preço de venda e dos materiais. Preço sugerido é `costCents / (1 - targetMargin)` com meta em `[0, 1)`, arredondado para cima ao centavo para não ficar abaixo da meta. A implementação atual recebe a meta em pontos-base inteiros de 0 a 9999 (`suggestPrice(costCents, marginBasisPoints)`). Aprovação de orçamento congela custo e margem estimados; consumo, perda e despesa direta alteram a margem real por eventos posteriores. Terceirização real substitui a estimativa do mesmo componente, sem somar. Compra de material e produção de acabado elevam o estoque valorizado; o resultado reconhece custo no consumo da OS, na perda ou na venda do acabado, enquanto o caixa reconhece o pagamento da compra no momento financeiro.

## 3. Estados e comandos de negócio

**Estado:** previsto (F3 a F5).

**Orçamento:** rascunho → emitido → revisado ou vencido → aprovado ou recusado. Revisão parcial copia apenas itens aceitos e exige emissão e aprovação dessa nova versão. A aprovação exige data, canal e nota opcional e cria OS, subitens, snapshot de medidas, reservas e recebível numa transação idempotente.

**OS:** produção, entrega e financeiro são independentes; a OS só fecha quando todos os subitens foram reconciliados e entregues ou formalmente cancelados e o financeiro está resolvido. Alteração de preço, material prometido ou prazo exige revisão comercial e aprovação renovada; notas internas e etapas não. Cancelamento após execução exige classificação de material retornado, consumido ou perdido, cobranças mantidas e reembolso ou saldo explícito.

**OP:** quantidade planejada, consumo, unidades boas, perdas e fechamento; pode emitir unidades boas parciais.

**Venda direta:** baixa a variante pronta e cria recebível ou pagamento; devolução preserva a venda original e cria reversão com destino.

**Fluxo de produção:** definição versionada compartilhada por OS e OP. O dono renomeia, reordena, oculta e adiciona etapas, gerando nova versão. Cada ordem recebe a versão vigente ao ser criada e só troca por migração manual; catálogos sugerem etapas aplicáveis, a seleção congela ao começar, as não aplicáveis são puladas e a OS avança por subitem. A agenda agrega prazos e minutos estimados por dia e por semana, incluindo visitas e provas; capacidade excedida pede confirmação e registra esse override.

Saldos negativos e pagamentos excedentes são exceções operacionais visíveis, nunca motivo para descartar um evento real confirmado.

## 4. API, sincronização e conflito

**Estado:** contrato mínimo implementado (§0); espelho completo previsto na F6.

oRPC expõe recursos autenticados de consulta e comando para cada agregado e as procedures de sync em `/rpc` ([ADR 0013](adr/0013-contrato-minimo-de-sincronizacao.md)). Contrato atual:

```ts
type Money = string; // centavos inteiros
type Quantity = string; // milionésimos da unidade base
type Operation = {
  opId: string; // UUID
  deviceId: string;
  epoch: string; // UUIDv4 da instalação
  aggregateType: string; // "installation" | "device"
  aggregateId: string;
  baseVersion: number | null;
  occurredAt: string; // ISO 8601 com fuso
  command: string; // "installation.setAtelierName" | "device.rename"
  payload: unknown;
  mediaHashes?: string[]; // previsto
};
type QuarantineReason =
  | "epoch"
  | "opIdReused"
  | "deviceMismatch"
  | "unknownCommand"
  | "invalidPayload"
  | "aggregateNotFound"
  | "invalidEnvelope";
type PushResult = {
  accepted: { opId: string; newVersion: number }[];
  conflicts: { opId: string; conflictId: string; currentVersion: number; current: unknown }[];
  quarantined: { opId: string | null; reason: QuarantineReason }[];
  exceptions: { opId: string; kind: string; referenceId: string }[];
  cursor: string;
  epoch: string;
};
type PullResult = {
  changes: { cursor: string; aggregateType: string; aggregateId: string; version: number; data: unknown }[];
  cursor: string;
  epoch: string;
  serverVersion: string;
  rebase: boolean;
  hasMore: boolean;
};
```

**`sync.push({ operations })`**, de 1 a 100 itens por chamada; lista vazia ou maior responde 400 `BAD_REQUEST` sem processar nada. Exige sessão do dono, instalação `ready` e dispositivo aprovado pelos cabeçalhos `x-costura-device-id` e `x-costura-device-secret`. Cada item é validado sozinho: item fora do formato de `Operation` vira quarentena `invalidEnvelope` sem barrar os outros, gravada em `operation` quando traz `opId` UUID válido e só auditada, com `opId: null` na resposta, quando não traz. Cada operação roda numa transação curta, na ordem recebida, e decide nesta ordem: `opId` já gravado (mesmo SHA-256 do JSON canônico devolve o resultado gravado; conteúdo diferente vira `opIdReused` só na auditoria, sem tocar o original), `deviceId` diferente do autenticado, epoch diferente, comando ou tipo desconhecido, payload inválido, agregado inexistente e, por fim, versão-base diferente, que abre conflito com valores locais e atuais lado a lado; `baseVersion: null` nunca coincide com a versão atual e o conflito guarda o `null`. Aceita aplica, incrementa `version` e grava o snapshot no log de mudanças. Quarentena e conflito também gravam resultado e evento de auditoria; nada é descartado. Mudanças independentes não param por causa de um conflito. Comandos de fato (venda, pagamento, consumo) aceitarão concorrência e criarão exceção de saldo; edições de campos sobre versão-base diferente viram conflito, nunca última gravação vence às cegas. Retry de mídia usará hash de conteúdo.

**`sync.pull({ cursor, epoch, limit })`**: cursor em string decimal (`"0"` no início), até 500 mudanças por página com `hasMore`. `epoch` é `string | null`; `null` (primeiro sync do aparelho) ou epoch diferente do servidor devolve `rebase: true` e leitura desde o início. `serverVersion` é o `version` do `apps/server/package.json`. Hoje o log traz a instalação `{ id, atelierName, state, version }` e dispositivos `{ id, name, status, version, createdAt, approvedAt, revokedAt }`, sem segredos; os agregados entram a partir da F3 até espelhar clientes, catálogo, estoque, OS, OP, vendas, finanças e documentos.

**`sync.resolve({ opId, conflictId, choice, values?, reason })`**: `keepLocal` aplica os valores locais sobre a versão atual, `keepServer` fecha sem mudar e `merge` valida e aplica `values`; motivo de 1 a 200 caracteres, idempotente por `opId`, uma única vez por conflito (`CONFLICT` depois) e auditado. Devolve `{ choice, conflictId, version }`. Aceita dispositivo aprovado ou acesso local com sessão, como `sync.pending()`, que devolve `{ conflicts, quarantined }`: conflitos abertos (com `baseVersion` possivelmente `null`) e quarentenas `{ opId, command, occurredAt, reason }` em ordem de chegada, incluindo as `opIdReused` lidas da auditoria. Sessão remota sem dispositivo recebe `UNAUTHORIZED` nas duas.

**Operações diretas.** Os comandos do wizard, da recuperação e dos dispositivos também gravam o resultado na tabela `operation` por `opId`, na mesma transação do efeito, com hash do conteúdo sem senha, código ou segredo; o tipo do handler só compila quando o resultado passa pela gravação. Chamadas simultâneas com o mesmo `opId` no processo entram numa fila, e a segunda recebe o resultado gravado. A repetição devolve o resultado gravado com os segredos anulados, e `opId` reutilizado com outro conteúdo responde `CONFLICT`. Respostas:

| Procedure | Resposta | Na repetição |
|---|---|---|
| `installation.setAtelierName` | `{ version }` | igual |
| `installation.createOwner` | `{ userId }` | igual, mesmo com outra senha |
| `installation.generateRecoveryCodes` | `{ codes }` | `{ codes: [] }` |
| `installation.confirmRecoveryCodes`, `recovery.resetPassword` | `{ ok: true }` | igual |
| `installation.testBackupFolder` | `{ ok: true, testedAt }` | igual |
| `installation.finish` | `{ state: "ready" }` | igual |
| `devices.createActivationCode` | `{ code, expiresAt }` | `code: null` |
| `devices.register` | `{ deviceId, deviceSecret, status }` | `deviceSecret: null` |
| `devices.approve`, `devices.revoke` | `{ status, version }` | igual | Os testes exercitam o Hono autenticado sobre SQLite real, nunca banco simulado em memória.

Dispositivo isolado por qualquer tempo faz rebase do snapshot completo sem apagar a outbox. Atualização do cliente migra Dexie e outbox antes do sync; operações incompatíveis vão para quarentena. Restauração incrementa o epoch e toda operação antiga é retida para reaplicação manual, nunca mesclada automaticamente ([ADR 0004](adr/0004-backup-epoch-e-cofre-por-dispositivo.md)).

**Mídia.** Upload autenticado por hash SHA-256, MIME permitido e limite configurado; referência de banco e gravação de arquivo são finalizadas com verificação de hash. O original é convertido e limitado na captura (JPEG ou WebP conforme suporte, dimensão máxima inicial de 2048 px, qualidade inicial 0,82) e ganha miniatura. Todas as miniaturas do espelho ficam offline; imagem grande já vista pode ser cacheada.

**PDF.** Fontes e templates versionados empacotados com a PWA; a emissão gera bytes finais, SHA-256, dados congelados e documento com versão. O servidor nunca regenera documento antigo com template novo ([ADR 0008](adr/0008-documentos-emitidos-imutaveis.md)).

## 5. Segurança e armazenamento local

**Estado:** conta, bootstrap, dispositivos e auditoria implementados no servidor (§0); cofre e PWA offline previstos (F6).

**Conta.** Better Auth mantém uma única conta de dono com o plugin `username` (3 a 30 caracteres, normalizados em minúsculas) e senha de 10 a 128 caracteres. O e-mail técnico exigido pela base de e-mail e senha é local (`owner@costura-pro.local`) e não é canal de recuperação. Cadastro público fica desativado após o onboarding, garantido no servidor e não só na interface. Sessão server-side usa o cookie `costura-pro.session_token` (`advanced.cookiePrefix`, para não colidir com outro app em `localhost`), `HttpOnly` e `SameSite=Lax`, com `baseURL` `http://127.0.0.1:<PORT>` e `trustedOrigins` `http://127.0.0.1:*`, `http://localhost:*` e `CANONICAL_ORIGIN`. O Better Auth calcula `Secure` uma vez por instância, então roda com `useSecureCookies: false` e o servidor acrescenta `Secure` a todo `Set-Cookie` quando o Host é o da origem canônica; no loopback HTTP o cookie sai sem `Secure`, que WebKit e libsoup descartariam. O Hono repassa ao Better Auth só a allowlist `/sign-in/username`, `/sign-out`, `/get-session`, `/change-password`, `/list-sessions`, `/revoke-session`, `/revoke-other-sessions` e `/ok`; qualquer outra rota sob `/api/auth` responde 404 sem chegar ao Better Auth. O rate limit do Better Auth fica na tabela `rate_limit` (`storage: "database"`), com 5 tentativas por 60 s em `/sign-in/username` por IP lido só de `cf-connecting-ip` (`advanced.ipAddress.ipAddressHeaders`); requisições locais não trazem o cabeçalho e dividem um único balde, e o Better Auth agrupa IPv6 por prefixo /64 (`advanced.ipAddress.ipv6Subnet`, padrão 64). Além dele, o bloqueio remoto global: a cada 5 falhas remotas seguidas (401), o login remoto responde 429 `Muitas tentativas. Tente de novo mais tarde.` com `Retry-After` por 1 min, dobrando até 30 min; o sucesso remoto zera a contagem e o acesso local nunca consulta nem altera o bloqueio. A tentativa remota é reservada antes de chegar ao Better Auth, numa transação que já a conta como falha e grava o bloqueio no múltiplo de 5; a resposta acerta a conta (200 zera, 401 mantém, qualquer outra devolve a reserva), então tentativas paralelas não passam do limite. Todo resultado de login vira evento de auditoria sem senha nem username tentado, uma sequência de recusas por bloqueio gera um único evento `locked`, e os erros não revelam se o usuário existe ([ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md)). [Better Auth: plugin Username](https://better-auth.com/docs/plugins/username), [Better Auth: rate limit](https://better-auth.com/docs/concepts/rate-limit), [Better Auth: hooks](https://better-auth.com/docs/concepts/hooks).

**Bootstrap da conta (F2):**

- A instalação é um registro singleton criado no boot, com epoch UUIDv4. O dono nasce só por `installation.createOwner` no acesso local, com compare-and-set do passo `atelier` para `account` e `auth.api.signUpEmail` no servidor (`autoSignIn: false`); o concorrente perde com `PRECONDITION_FAILED`, e a falha devolve o passo para `atelier` com evento `owner.bootstrap_failed`. `databaseHooks.user.create.before` recusa qualquer segundo usuário. Nenhuma rota HTTP de cadastro responde.
- O username chega normalizado (espaços nas pontas fora e minúsculas) antes de virar `username` e `name` do usuário.
- O adapter do Better Auth grava usuário e conta sem transação: a falha do `createOwner` apaga usuários sem conta `credential` antes de devolver o passo, e o boot reconcilia uma instalação em `account` sem dono, adotando a única conta com credencial ou, sem nenhuma, apagando órfãos e voltando para `atelier`; os dois caminhos geram evento com `recovered: true`.
- Cliente web com `usernameClient({ displayUsername: false })` e `signIn.username`; `/is-username-available` fica fechado pela allowlist.
- A política de cookie por origem está implementada e testada nas duas (HTTP local e Host canônico) desde a F0 e continua com o login por username.
- O wizard é uma máquina de estados retomável (`empty → atelier → account → recovery → backup → ready`) com as procedures `installation.status` (qualquer acesso), `setAtelierName` (acesso local; sem sessão só em `empty` e `atelier`), `createOwner`, `generateRecoveryCodes` e `confirmRecoveryCodes`, `listFolders` e `testBackupFolder` (a partir de `recovery`) e `finish` (de `backup` para `ready`). Passo fora de ordem responde `PRECONDITION_FAILED` com o estado, e toda procedure de negócio exige `ready`. O dashboard redirecionará ao passo pendente quando as telas do wizard existirem, e `ready` exige pasta de backup testada: o dono escolhe a pasta no acesso local, num navegador de pastas alimentado pelo servidor que lista o que a conta do serviço enxerga (letra de unidade mapeada não existe para o serviço; pasta de rede só por caminho UNC), e o servidor grava e relê um arquivo de teste com nome aleatório e apaga só esse arquivo. Cliente remoto nunca lista pastas nem escolhe caminho no servidor.

**Dispositivos e recuperação.** O acesso local, com sessão do dono, aprova ou revoga dispositivos (`devices.approve`, `devices.revoke`, `devices.list`) ou emite código de ativação de uso único (`devices.createActivationCode`: 8 caracteres Crockford, 10 min, só um ativo). Com 40 bits, o código é guardado como HMAC-SHA-256 com o segredo do Better Auth, não como SHA-256 puro, para não ser invertido de um backup; trocar o segredo só invalida o código ativo. `devices.register` exige sessão e instalação `ready`, entrega uma única vez o segredo do dispositivo (32 bytes em base64url, guardado como SHA-256) e nasce `pending`, ou `approved` com código válido; um celular novo só obtém espelho sensível após aprovação, e dispositivo pendente ou revogado recebe `FORBIDDEN`. Códigos de recuperação: 10 de 16 caracteres Crockford (`XXXX-XXXX-XXXX-XXXX`, 80 bits), apresentados uma vez e guardados só como SHA-256 do código normalizado; gerar de novo invalida o jogo anterior, e `recovery.resetPassword`, só no acesso local, confere que há dono registrado, consome o código, troca a senha e apaga as sessões na mesma transação; sem dono o código continua válido. O resgate físico extremo exige administrador do sistema operacional no PC, redefine só a conta, emite novos códigos de recuperação e cria evento de auditoria. O token do Tunnel é segredo de instalação com permissões do sistema operacional, fora do banco exportado, do backup e dos logs.

**Auditoria.** A tabela `audit_event` é append-only (triggers recusam UPDATE e DELETE, como no `change_log`) e guarda tipo, momento, acesso, IP só quando remoto, dispositivo, resultado e detalhes sem senha, código, segredo ou username tentado. O mesmo evento sai no evento amplo do evlog da requisição, em `audit.<tipo>` com acesso e resultado. Erro de procedure vai ao console só com código, status, mensagem e o código e caminho de cada problema de validação, nunca com o valor recebido.

**Cofre.** No primeiro espelho, cada dispositivo cria sal e senha forte de cofre. WebCrypto deriva a chave por PBKDF2-HMAC-SHA-256 com parâmetro calibrado e versionado por plataforma e cifra registros e arquivos com AES-256-GCM, nonce novo por objeto e AAD com dispositivo, epoch, tipo e id. A senha não é enviada ao servidor nem recuperada por códigos da conta. O PIN bloqueia apenas a interface durante inatividade em primeiro plano; quando o app vai para segundo plano ou fecha, a chave é descartada da memória e a senha do cofre é exigida na volta. A outbox exportada inclui manifesto, identidade do dispositivo, epoch, `opId`s, hashes, sal e parâmetros e bytes cifrados; pode ser importada numa nova instalação com a senha, após validação de integridade, mantendo idempotência. Senha esquecida exige apagar o cofre local e reconstruir o espelho; outbox não exportada e perdida não é recuperável.

**PWA.** `display: standalone`, service worker com app shell, assets, fontes e templates offline, Dexie para espelho e outbox cifrados, tratamento de quota e eviction, pedido de `navigator.storage.persist()` e exportação manual. No iOS, abrir no Safari ou instalar um segundo ícone cria outra instância e outra identidade. A interface mostra conexão, último sync, operações pendentes, falhas e exceções. A sessão offline do app não vence, mas a sessão remota do Better Auth pode exigir login ao reconectar sem apagar a fila. Revogação remota só produz efeito no próximo contato.

## 6. Documentos, backup, restauração e atualização

**Estado:** previsto (F4 e F7).

**Documentos.** PDFs não fiscais em A4 e 80 mm, com logo, nome, contato, endereço, código, data, itens visíveis, descontos, totais e pagamentos conforme o tipo. Dados de emissão, bytes, template, fontes e hash são imutáveis; revisão ou estorno referencia a emissão anterior. PDF final e fotos emitidos offline entram no cofre e no sync. Impressão pelo diálogo padrão do navegador. Compartilhar é ação explícita do dono; o atalho de WhatsApp não envia automaticamente.

**Backup.** Agendado às 02:00, usa transação ou barreira curta para fixar o manifesto de mídia e um snapshot SQLite consistente. `bun:sqlite` executa `VACUUM INTO` para cópia consistente; a API `node:sqlite` do Bun está marcada como não implementada e não deve ser usada. Copiar exatamente os arquivos referenciados pelo snapshot, montar pacote temporário com manifesto de versão, schema, tamanhos e SHA-256 de cada arquivo, validar `PRAGMA integrity_check` e só então promover o arquivo final na pasta escolhida. No boot, executar backup compensatório se o último dia local não tem cópia. Reter as 7 últimas cópias diárias válidas; no início de cada mês, preservar a última diária válida do mês anterior como mensal, mantendo as 12 últimas mensais. Aplicar retenção só depois de nova cópia validada; na falta de espaço ou falha, nunca remover cópia para abrir espaço. Fotos originais otimizadas, miniaturas, PDFs e configuração não secreta entram no pacote; Tunnel e cofres não. O pacote não é cifrado. [SQLite: backup e VACUUM INTO](https://www.sqlite.org/backup.html), [Bun: SQLite](https://bun.com/docs/runtime/sqlite), [Bun: `node:sqlite`](https://bun.com/reference/node/sqlite).

**Restauração.** Só no acesso local: validar pacote, hash, schema e versão antes de substituir, pedir código de recuperação, pausar escritas e sync, fazer pré-backup do estado atual, trocar dados e arquivos de forma atômica ou por staging verificável, incrementar o epoch, testar integridade e saúde e manter o pré-backup recuperável. Falha nunca promove estado parcial. Outboxes antigas vão para quarentena.

**Atualização** ([ADR 0005](adr/0005-atualizacao-coordenada.md)). Mesmo princípio: janela ociosa após backup, bloquear novas escritas, pré-backup, staging de binários assinados, migração, checagem de saúde de API, banco, mídia e serviços e promoção; falha reverte binários, banco e mídia e reabre escritas. Operações aceitas durante a janela nunca são descartadas. Um supervisor de instalação, fora do processo do servidor, é o único canal de atualização e coordena servidor e serviços. Releases públicos do GitHub fornecem manifesto e artefatos Windows x64 e Linux x64 assinados em formato minisign (Ed25519), que o supervisor verifica com WebCrypto antes de trocar qualquer arquivo; a chave privada nunca fica no repositório. [minisign](https://jedisct1.github.io/minisign/). O `cloudflared` é atualizado separadamente com checagem de conectividade, sem modificar o token.

## 7. Empacotamento, observabilidade e testes

**Estado:** observabilidade parcial; empacotamento previsto (F7); testes de domínio e banco já existem.

**Windows.** Instalador NSIS 3.12 ou superior por máquina, com elevação, e servidor Bun compilado para Windows x64 registrado como serviço de início automático por wrapper (shawl ou WinSW 2.12 NET461, escolhido no S5), porque o executável do Bun não atende o gerenciador de serviços sozinho. Conta do serviço decidida no S5, com conta virtual primeiro; dados em ProgramData com herança de permissão cortada; atalho do acesso local no Edge em modo app; desinstalação preservando dados e backups salvo pedido explícito. Sem certificado comercial inicial pode haver SmartScreen; assinatura de atualização é obrigatória. [NSIS](https://nsis.sourceforge.io/Download), [shawl](https://github.com/mtkennerly/shawl), [WinSW](https://github.com/winsw/winsw).

**Linux.** Pacote `.deb` para Ubuntu 24.04 LTS x64 com unit `systemd` (usuário dedicado e `StateDirectory`) e `.desktop` que abre o acesso local em Google Chrome ou Chromium com `--app`, ou no navegador padrão, com dados em `/var/lib/costura-pro`; privilégios são pedidos pelo instalador, nunca pelo app diário. O Bun gera binário standalone para Windows e Linux, mas o banco vivo fica sempre fora dele. [Bun: executáveis](https://bun.com/docs/bundler/executables), [systemd.exec](https://man7.org/linux/man-pages/man5/systemd.exec.5.html).

**Observabilidade.** evlog registra operação relevante, erro de sync e conflito, backup, restauração, atualização e saúde de serviços e Tunnel, com IDs de correlação e sem senhas, token, medidas, fotos ou dados completos de cliente. A tela de diagnóstico mostra última cópia válida, espaço, versão, sync, dispositivos, Tunnel e erros recuperáveis. Não há telemetria externa por padrão.

**Testes.**

| Camada | Como |
|---|---|
| Domínio | `bun test` com fixtures de dinheiro e quantidade |
| Banco e integração | SQLite real em diretório temporário, migrations reais, Hono e oRPC |
| Mídia, backup e restauração | Pasta temporária, hashes e manifesto |
| Sync | Duas outboxes, ordem inversa, retry, epoch antigo |
| Interface | Jornadas em navegador real com browser-harness, desktop e celular; sem Playwright |
| Plataformas | Validação manual em Windows, Ubuntu 24.04, Chrome Android e Safari iPhone |

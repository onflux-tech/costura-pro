# SPEC: Costura Pro v1

| Campo | Valor |
|---|---|
| Autoridade | O [PRD](PRD.md) define comportamento; [CONTEXT](../CONTEXT.md) define nomes; os [ADRs](adr/) justificam fronteiras difíceis. Esta SPEC define os contratos mínimos para implementar a v1 |
| Estado | Contratos alvo da v1. O que já existe no código está na [§0](#0-estado-de-implementação); o restante é previsto e segue a ordem do [ROADMAP](ROADMAP.md) |
| Última revisão | 2026-09-18 |

Não é formato fiscal. Quando um contrato muda, atualize esta SPEC, a linha correspondente da §0 e, se a decisão for de mão única, o ADR.

## 0. Estado de implementação

| Contrato | Estado | Onde está hoje | Fase |
|---|---|---|---|
| Monorepo e PWA básica gerados pelo scaffold, sem app desktop (DEC-59) | Implementado | `apps/web`, `apps/server`, `packages/*` | F0 |
| Design system: tokens, componentes base, navegação agrupada e catálogo de desenvolvimento | Implementado, com o shell ligado às rotas | `packages/ui/src/styles/globals.css`, `packages/ui/src/components/`, `packages/ui/src/lib/navigation.ts`, `apps/web/src/lib/destinations.ts`, `apps/web/src/shell/`, `apps/web/src/routes/_app/`, `apps/web/src/routes/catalogo.tsx`, [design system](areas/design-system.md) | F1, F2 (shell) |
| Preço sugerido com margem sobre a venda | Implementado como função pura testada | `packages/domain/src/pricing.ts` | F0 |
| Reserva com pendência sem inventar saldo | Implementado como função pura testada | `packages/domain/src/reservation.ts` | F0 |
| SQLite nativo em WAL, validação de caminho local, migrations por Bun | Implementado | `packages/db/src/index.ts`, `packages/db/src/migrate.ts`, `packages/db/tests/native-sqlite.test.ts` | F0 |
| Schema de autenticação, instalação, auditoria e sync | Implementado: tabelas do Better Auth com `username` e `rate_limit`, instalação singleton, guarda de login, códigos de recuperação, auditoria e log de mudanças append-only, dispositivos, códigos de ativação, operações e conflitos | `packages/db/src/schema/`, migrations `0000` a `0002`, `packages/db/tests/installation-sync-schema.test.ts` | F2 |
| Mesma origem: Hono serve SPA e API só em loopback | Implementado: processo único em `127.0.0.1:3000`, allowlist de Host e Origin, cookie `Secure` por Host canônico, cliente relativo e proxy do Vite para o loopback | `apps/server/src/app.ts`, `apps/server/src/origin.ts`, `apps/server/src/web.ts`, `apps/server/src/index.ts`, `apps/web/src/utils/orpc.ts`, `apps/web/vite.config.ts`, `apps/server/tests/` | F0 |
| Logs estruturados | Parcial: evlog no servidor, drain em arquivo fora de produção | `apps/server/src/index.ts` | F0 a F7 |
| Dono único, username, rate limit persistido, bloqueio remoto, códigos de recuperação, auditoria | Implementado no servidor; login web por username com retorno ao destino pedido | `packages/auth/src/index.ts`, `apps/server/src/auth-routes.ts`, `apps/server/src/access.ts`, `packages/api/src/sign-in-guard.ts`, `packages/api/src/installation/`, `packages/api/src/recovery/`, `packages/api/src/audit.ts`, `apps/web/src/components/sign-in-form.tsx`, `apps/web/src/routes/login.tsx`, `apps/server/tests/access.test.ts`, `sign-in.test.ts`, `installation.test.ts` | F2 |
| Wizard inicial e sandbox | Parcial: estados, comandos, navegador de pastas e teste de gravação no servidor, telas retomáveis, redirecionamento ao passo pendente e checklist de continuidade em Hoje; sandbox prevista | `packages/api/src/installation/`, `apps/web/src/wizard/`, `apps/web/src/lib/installation-gates.ts`, `apps/web/src/routes/configuracao-inicial.tsx`, `apps/web/src/today/`, `apps/web/tests/installation-gates.test.ts` | F2 (wizard), F5 (sandbox) |
| Acesso local, navegador de pastas e atalhos do instalador | Parcial: acesso local e navegador de pastas implementados; atalhos previstos | `apps/server/src/access.ts`, `packages/api/src/index.ts`, `packages/api/src/installation/backup-folder.ts`, `apps/web/src/wizard/folder-browser.tsx` | F2 (acesso local e pasta de backup), F7 (instalador e atalhos) |
| Dispositivos, epoch, `push`, `pull`, `resolve` | Parcial: contrato mínimo implementado (dispositivos com segredo, código de ativação, operação por `opId`, log por cursor, conflito, quarentena, `rebase`); espelho completo previsto | `packages/api/src/devices/`, `packages/api/src/sync/`, `packages/api/src/operations.ts`, `apps/server/tests/devices.test.ts`, `sync.test.ts` | F2 (contrato mínimo), F6 (espelho completo) |
| Cliente pagador e perfil de usuário da peça: cadastro, busca, arquivamento e anonimização, com comandos nos dois caminhos | Implementado, sem medidas e fotos | `packages/domain/src/client.ts`, `packages/db/src/schema/clients.ts`, migrations `0003` e `0004`, `packages/api/src/clients/`, `packages/api/src/aggregate-command.ts`, `apps/web/src/atendimento/`, `apps/web/src/routes/_app/atendimento/`, `apps/server/tests/clients.test.ts`, `clients-sync.test.ts`, [agregados](areas/agregados.md) | F3 |
| Modelos de medidas versionados, modelos iniciais semeados e medições por perfil com correção, arquivamento, histórico e redação na anonimização | Implementado | `packages/domain/src/measurement.ts`, `packages/db/src/schema/measurements.ts`, migration `0005`, `packages/api/src/measurements/`, `packages/api/src/update-command.ts`, `apps/server/src/app.ts` (semeadura), `apps/web/src/atendimento/` (ficha, registrar, corrigir, histórico), `apps/web/src/measurement-templates/`, `apps/web/src/lib/measurements.ts`, `apps/server/tests/measurements.test.ts`, `measurements-sync.test.ts`, [agregados](areas/agregados.md) | F3 |
| Peça recebida com fotos de condição e mídia endereçada por conteúdo: upload e leitura por hash, gravação atômica, coleta de órfãos e anonimização com arquivos | Implementado, sem código de custódia, comprovante e etiqueta | `packages/domain/src/received-item.ts`, `packages/domain/src/media.ts`, `packages/db/src/schema/received-items.ts`, `packages/db/src/schema/media.ts`, migration `0006`, `packages/api/src/received-items/`, `packages/api/src/media/`, `packages/api/src/clients/anonymize.ts`, `apps/server/src/media.ts`, `apps/web/src/atendimento/` (painel, receber, detalhe, correção, fotos), `apps/web/src/lib/received-items.ts`, `apps/web/src/lib/photo-capture.ts`, `apps/server/tests/media.test.ts`, `media-collect.test.ts`, `received-items.test.ts`, `received-items-sync.test.ts`, `received-items-anonymization.test.ts`, [mídia](areas/midia.md), [agregados](areas/agregados.md) | F3 (F4: código, comprovante e etiqueta) |
| Material base e variante de material: cadastro, busca, categoria, unidade base, precisão exibida, custo de referência, mínimo, alvo, embalagem de compra, foto e controle por lote | Implementado | `packages/domain/src/unit.ts`, `quantity.ts`, `money.ts`, `material.ts`, `packages/db/src/columns.ts`, `packages/db/src/schema/materials.ts`, migration `0007`, `packages/api/src/materials/`, `apps/web/src/materials/`, `apps/web/src/lib/materials.ts`, `packages/ui/src/components/number-field.tsx`, `select.tsx`, `suggestion-field.tsx`, `apps/server/tests/materials.test.ts`, `materials-sync.test.ts`, [catálogo de materiais](areas/catalogo.md) | F3 |
| Local de estoque, lote, movimento imutável e projeção de saldo: abertura, ajuste rápido, transferência e estorno | Implementado, sem sessão de inventário | `packages/domain/src/stock.ts`, `packages/db/src/schema/stock.ts`, migrations `0008` e `0009`, `packages/api/src/stock/`, `apps/web/src/stock/`, `apps/web/src/lib/stock.ts`, `apps/web/src/routes/_app/estoque/`, `packages/db/tests/stock-schema.test.ts`, `apps/server/tests/stock.test.ts`, `stock-sync.test.ts`, [estoque](areas/estoque.md) | F3 (F3: sessão de inventário) |
| Fornecedor e compra com conversão de embalagem, rateio de frete e desconto, obrigação e estorno | Implementado, sem lista de compras consolidada | `packages/domain/src/purchase.ts`, `supplier.ts`, `packages/db/src/schema/purchases.ts`, migrations `0010` e `0011`, `packages/api/src/purchases/`, `apps/web/src/purchases/`, `apps/web/src/lib/purchases.ts`, `apps/web/src/routes/_app/compras/`, `packages/db/tests/purchases-finance-schema.test.ts`, `apps/server/tests/purchases.test.ts`, `purchases-sync.test.ts`, `suppliers.test.ts`, [compras](areas/compras.md) | F3 (F4: lista de compras consolidada) |
| Conta financeira, movimento financeiro (abertura, transferência, estorno) e quitação de obrigação | Implementado, sem recebível, cartão e despesa | `packages/domain/src/finance.ts`, `packages/db/src/schema/finance.ts`, migrations `0010` e `0011`, `packages/api/src/finance/`, `packages/api/src/purchases/commands.ts` (`obligation.pay`), `apps/web/src/finance/`, `apps/web/src/lib/finance.ts`, `apps/web/src/routes/_app/financas/`, `apps/server/tests/finance.test.ts`, `finance-sync.test.ts`, [finanças](areas/financas.md) | F3 (F4 e F5: recebível, pagamento de cliente, cartão, despesa) |
| Serviço com custo, preço praticado, meta de margem do ateliê e meta própria, e preço sugerido calculado na tela | Implementado, sem etapas sugeridas | `packages/domain/src/service.ts`, `pricing.ts`, `packages/db/src/schema/services.ts`, `installation.ts`, migration `0012`, `packages/api/src/services/`, `apps/web/src/services/`, `apps/web/src/lib/services.ts`, `apps/web/src/routes/_app/catalogo-produtos/servicos/`, `packages/db/tests/services-schema.test.ts`, `apps/server/tests/services.test.ts`, `services-sync.test.ts`, [serviços](areas/servicos.md) | F3 (F4: etapas sugeridas e cópia na linha do orçamento) |
| Produto e ficha técnica | Previsto | | F3, F4 |
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

**Acesso local** (regra implementada na F2, atalhos na F7; DEC-59, [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md)). O PC usa a interface no navegador pela origem local `http://127.0.0.1:<PORT>`, sem app desktop. No Windows o instalador cria atalho para `msedge.exe --app=http://127.0.0.1:<PORT>/`, com o navegador padrão quando não houver Edge; no Ubuntu um `.desktop` abre Google Chrome ou Chromium com `--app` e usa `xdg-open` quando não houver nenhum. A origem local é a identidade da interface no PC (cookie, service worker e cache), então a porta definitiva sai do S5 e nunca muda. Uma requisição é do acesso local quando o Host é de loopback (`127.0.0.1` ou `localhost`) e não traz `cf-connecting-ip`, nunca pelo IP do socket, porque o `cloudflared` também conecta pelo loopback. Ações administrativas exigem isso e a sessão do dono, com quatro exceções sem sessão, todas só no acesso local: `installation.setAtelierName` e a leitura `installation.details` enquanto a instalação está em `empty` ou `atelier`, `installation.createOwner` no passo `atelier` e `recovery.resetPassword`, em que o código de recuperação é a credencial (§5).

SQLite em WAL é a fonte autoritativa única, aberta por Drizzle sobre `bun:sqlite`, e um processo servidor controla gravações e transações ([ADR 0006](adr/0006-sqlite-nativo-bun.md)). Banco e mídia ficam fora do diretório de instalação: `%PROGRAMDATA%\CosturaPro\data` no Windows e `/var/lib/costura-pro` no Linux; a mídia fica na subpasta `media` da pasta do `DATABASE_FILE`, no mesmo volume do banco ([ADR 0016](adr/0016-midia-enderecada-por-conteudo.md)). Configuração e segredos usam permissões do sistema operacional. O instalador configura o servidor como serviço ativo no boot, pelo wrapper escolhido no S5, o atalho do acesso local e o `cloudflared` como serviço opcional após receber o token ([ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md)). Sem internet, o PC segue no loopback; a PWA já carregada opera pelo service worker e IndexedDB e não sincroniza até o Tunnel voltar.

Não usar addon de billing, SaaS ou fiscal. Harness de agentes, MCPs e skills estão em [HARNESS](HARNESS.md).

## 2. Persistência, valores e fronteiras de domínio

**Estado:** persistência e valores parciais; agregados previstos (§0).

**Identidade e códigos** ([ADR 0009](adr/0009-uuid-e-codigo-documental-por-dispositivo.md)). Identidades são UUIDv4 gerados por `crypto.randomUUID()` no dispositivo. Códigos humanos permanentes usam tipo, ano local, sigla do dispositivo e contador local, sem sequência global (`ORC-2026-CEL-0042`). Código não é chave primária.

**Dinheiro e quantidade** ([ADR 0010](adr/0010-dinheiro-e-quantidade-inteiros.md), [ADR 0017](adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md)). Valores monetários são inteiros de centavos com sinal e quantidades são inteiros de milionésimos da unidade base, `bigint` no domínio, sem `float`. No disco os dois moram em coluna `integer` mapeada por `bigintInteger` (`packages/db/src/columns.ts`), que devolve `bigint` e recusa acima de 2^53 - 1; no JSON de payload, snapshot e `sync.pull` viajam como o inteiro em string de dígitos, canonicalizada (`"1250"` centavos, `"1500000"` milionésimos), nunca `number` nem `bigint`. A conversão acontece só no store. Cada variante declara precisão exibida de 0 a 6 casas, que é exibição e não restringe o que o servidor aceita, e declara a embalagem de compra opcional como rótulo mais quantidade na unidade base em milionésimos, que a compra copia e pode sobrescrever. Arredondamento monetário ao centavo, meio para cima; no rateio, cada linha recebe a parte arredondada para baixo e a última linha com peso fica com o resto (linha de peso zero, como um brinde, não recebe nada), o que conserva o total e nunca dá parte negativa de frete.

**Banco.** `DATABASE_FILE` é caminho absoluto local; URL remota, `:memory:`, caminho relativo e caminho UNC são rejeitados. `drizzle-kit` só gera SQL; migrations rodam pelo executor Bun (`pnpm db:migrate`). `db:push` nunca roda contra banco com dados reais.

**Agregados e movimentos.** Agregados com `version` monotônica: Cliente e Perfil, Modelo de medidas e Medição, Peça recebida, Material e Variante de material, demais catálogos e versões de ficha, Orçamento e Revisão, OS e Subitem, OP, Venda e Devolução, Compromisso e Documento. Tabelas separadas de movimentos imutáveis guardam estoque (abertura, compra, reserva e liberação, consumo, retorno, transferência, inventário, produção, venda, devolução, perda), custos (estimativa, real, ajuste), recebíveis e parcelas, pagamentos e alocações, contas e transferências, despesas e obrigações e auditoria. Projeções de saldo podem ser mantidas na mesma transação para consulta rápida, mas movimentos e documentos emitidos nunca são editados ou apagados ([ADR 0003](adr/0003-movimentos-imutaveis-e-custo-provisorio.md)). Exclusão de cliente é arquivamento ou anonimização autorizada, nunca cascata destrutiva.

**Cliente e perfil** ([DEC-72 a DEC-75](PRD.md#92-atendimento-e-agenda)). `client` guarda `kind` (`person` ou `organization`), `name` (1 a 120), `phone` e `secondary_phone` (só dígitos, 10 ou 11 com DDD de 11 a 99; `+55` na frente de número completo sai), `email` (até 254), `address` (até 200, uma linha), `notes` (até 2000), `archived_at`, `anonymized_at` e `search_text`. `search_text` é recalculado a cada escrita: nome, e-mail e telefones em NFD sem marcas, minúsculas e espaços colapsados; a busca quebra a consulta em tokens (trecho só de dígitos e `()-+.` vira só dígitos) e exige cada um por `LIKE` com `%`, `_` e `\` escapados. `client_profile` guarda `client_id`, `name`, `notes` e `archived_at`. Texto vazio vira `null`. Nenhum dos dois é apagado. O snapshot no `change_log` tem todos os campos com datas em ISO 8601, sem `search_text`. Anonimizar troca o nome por "Cliente anonimizado" ou "Perfil anonimizado", zera contatos e notas, arquiva e marca `anonymized_at`, e redige o histórico ([ADR 0014](adr/0014-anonimizacao-redige-historico-de-sincronizacao.md), `packages/api/src/redaction.ts`): `redacted_aggregate` append-only libera na trigger do `change_log` só a troca de `data` do agregado registrado; conflitos do agregado ficam fechados, sem valores e com motivo "Cliente anonimizado"; as operações do agregado, inclusive as resoluções de conflito, ficam com `op_hash` `redacted` e resultado de conflito com o snapshot anonimizado. O banco abre com `secure_delete` e a anonimização termina com `wal_checkpoint(TRUNCATE)`.

**Modelo de medidas e medição** ([DEC-77 a DEC-80](PRD.md#92-atendimento-e-agenda), [ADR 0015](adr/0015-medidas-em-milimetros-e-medicao-autocontida.md)).
- **Unidade.** Medida é inteiro de milímetros de 1 a 9999 (`valueMm`, `number` no domínio e no JSON), digitada e exibida em centímetros com no máximo uma casa por `parseCentimeters` e `formatCentimeters` (`packages/domain/src/measurement.ts`).
- **Modelo.** `measurement_template` guarda `name` (1 a 60), `fields` em JSON ordenado `[{ id, label, active }]`, `archived_at` e `version`, que é a versão exibida ("v3").
  - O payload de criação e edição leva só os campos ativos `{ id, label }`, de 1 a 60, com ids UUID únicos e rótulos (1 a 60) que não se repetem sem acento, caixa e espaços extras.
  - A edição grava `mergeTemplateFields`: os enviados ativos, na ordem enviada, seguidos dos atuais ausentes, desativados, na ordem atual. Campo nunca é apagado, e a lista gravada pode passar de 60 com no máximo 60 ativos.
- **Semeadura.** No boot, logo depois da instalação, `ensureMeasurementTemplates` cria Vestido, Saia, Calça, Blusa e camisa e Blazer e paletó, com `version` 1 e snapshot no `change_log` com `opId` nulo, quando a tabela está vazia; com qualquer linha, arquivada inclusive, não faz nada. O boot exige a migration `0005`.
- **Medição.** `measurement` guarda:
  - `profile_id` e `template_id` com chave estrangeira;
  - cópia de `template_name` e `template_version`;
  - `taken_on` (`AAAA-MM-DD`) e `notes` (até 2000; vazio vira nulo);
  - `fields` em JSON `[{ fieldId, label, valueMm | null }]` (1 a 60, `fieldId` único, pelo menos um valor);
  - `archived_at` e `version`.

  O aparelho compõe a medição com o modelo que vê; o servidor valida a forma e a existência do perfil e do modelo. A correção substitui `fields`, `notes` ou `taken_on` com versão-base.
- **Ordem.** Toda lista de medições segue a ordem total `taken_on`, `created_at` e `id`, todos decrescentes; a atual de um modelo é a primeira não arquivada, e a diferença exibida compara com a próxima não arquivada do mesmo modelo e perfil, pelo `fieldId`.
- **Anonimização.** Anonimizar o cliente zera todo `valueMm` e as notas das medições de todos os perfis, arquivadas inclusive, arquiva cada uma e as redige como os perfis; rótulos, modelo e data ficam. O modelo de medidas não tem dado pessoal.

**Peça recebida** ([DEC-83 a DEC-89](PRD.md#92-atendimento-e-agenda)).
- **Linha.** `received_item` guarda `client_id` com chave estrangeira, `description` (1 a 200), `condition` (`good`, `damaged` ou `worn`), `quantity` (inteiro de 1 a 999 em `number`, fora de estoque e faturamento, [ADR 0016](adr/0016-midia-enderecada-por-conteudo.md)), `accessories` (até 500), `notes` (até 2000), `photos`, `received_on`, `expected_return_on` e `returned_on` (`AAAA-MM-DD`, os dois últimos opcionais), `archived_at` e `version`. Texto vazio vira `null`.
- **Fotos.** `photos` é JSON `[{ photoHash, thumbnailHash, caption }]` com 0 a 12 itens, hashes SHA-256 em hex minúsculo, `photoHash` único na peça e legenda de 1 a 40 ou `null`; a ordem da lista é a de exibição. O servidor não confere se os arquivos existem.
- **Datas.** O servidor valida só a forma; devolução prevista e devolução não anteriores à recepção, devolução não futura, ano com quatro dígitos e, na correção de peça devolvida, recepção não posterior à devolução registrada são regras da tela (`receivedItemDateErrors` e `receivedItemFormErrors` em `apps/web/src/lib/received-items.ts`).
- **Ordem.** A lista segue `received_on`, `created_at` e `id`, todos decrescentes; em custódia é a peça não arquivada e sem `returned_on`.
- **Anonimização.** Anonimizar o cliente troca a descrição por "Peça anonimizada", zera acessórios, observações e fotos, arquiva e redige cada peça, arquivadas inclusive; estado, quantidade e datas ficam.

**Mídia** ([DEC-90 a DEC-92](PRD.md#96-plataforma-acesso-e-operação), [ADR 0016](adr/0016-midia-enderecada-por-conteudo.md), [mídia](areas/midia.md)).
- **Arquivo.** `media/<hash[0..2]>/<hash[2..4]>/<hash>.webp` ou `.jpg` dentro da pasta do `DATABASE_FILE`, gravado por temporário em `media/tmp`, `sync` e `rename`; final com o mesmo hash nunca é regravado e final corrompido é apagado antes do `rename`; `rename` e `unlink` repetem em `EPERM`, `EACCES` e `EBUSY`.
- **Linha.** `media_file` guarda `hash`, `mime` (`image/jpeg` ou `image/webp`), `byte_size` e `uploaded_at` (último envio conferido) e só é criada ou renovada depois do arquivo gravado.
- **Referência.** Um hash está referenciado quando aparece em `received_item.photos` ou nos valores de um `sync_conflict` aberto de `receivedItem`.
- **Coleta.** `collectMedia` roda no boot e a cada 1 h, sem sobrepor execuções: as candidatas saem de uma única consulta (linhas com `uploaded_at` há mais de 24 h fora do conjunto de hashes referenciados, montado uma vez por `json_each`), e cada uma é conferida de novo numa transação dentro da trava por hash, cedendo a vez ao servidor entre elas; arquivo sem linha com mais de 24 h (removido pelo caminho em que foi achado) e temporário com mais de 1 h saem.
- **Anonimização.** Junta os hashes das peças do cliente (linha viva, `change_log` e conflitos), apaga as linhas de `media_file` sem outra referência na mesma transação, antes do `truncateWal`, e remove os arquivos depois do commit; falha de remoção fica para a coleta.

**Material e variante de material** ([catálogo de materiais](areas/catalogo.md), [ADR 0017](adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md)).
- **Unidade base.** Lista fechada no domínio (`packages/domain/src/unit.ts`): `m`, `cm`, `m2`, `un`, `par`, `g`, `kg`, `ml` e `l`, cada uma com abreviação e precisão sugerida. O banco repete os códigos em `baseUnitValues`, e um teste compara as duas listas. A unidade é imutável depois da criação: o patch não a aceita.
- **Material.** `material` guarda `name` (1 a 120), `category` (1 a 40 ou nulo, texto livre com sugestões do domínio e das já gravadas), `notes` (até 2000), `search_text` (nome e categoria, recalculado a cada escrita, fora do snapshot), `archived_at` e `version`.
- **Variante.** `material_variant` guarda `material_id` com chave estrangeira, `name` (1 a 80), `code` (1 a 40 ou nulo, sem unicidade), `base_unit`, `display_precision` (0 a 6), `reference_cost_cents`, `min_quantity_micros`, `target_quantity_micros`, `packaging_label` com `packaging_quantity_micros` (os dois juntos ou os dois nulos), `photo` em JSON `{ photoHash, thumbnailHash }` ou nulo, `search_text` (nome e código), `archived_at` e `version`.
- **Busca.** Cada token da consulta casa o `search_text` do material ou o de alguma variante dele; a lista ordena por `search_text` e `id`, 50 por página, e `variantCount` conta variantes ativas.
- **Foto.** Um hash por variante, pela rota de mídia de sempre; os quatro caminhos JSON (linha viva e conflitos abertos de `materialVariant`, nos valores locais e atuais) entram em `referencedHashes` ([mídia](areas/midia.md)).
- **Dado pessoal.** Material e variante não têm; ficam fora de `personalDataAggregates` e nenhum comando deles é redigido.

**Local de estoque, lote, movimento e saldo** ([estoque](areas/estoque.md), [ADR 0018](adr/0018-movimento-append-only-com-projecao-de-saldo.md)).
- **Local.** `stock_location` guarda `name` (1 a 60), `notes` (até 2000), `archived_at` e `version`. Lista plana, sem hierarquia; nenhum local é semeado no boot.
- **Lote.** `stock_lot` guarda `variant_id` com chave estrangeira, `label` (1 a 60), `notes`, `archived_at` e `version`. Existe só para variante com `tracks_lots`; o custo de entrada do lote é derivado dos movimentos dele, não coluna própria.
- **Controle por lote.** `material_variant.tracks_lots` é declarado na criação e imutável como a unidade base: o patch não aceita o campo. Movimento sem lote em variante que controla lote, com lote em variante que não controla, ou com lote de outra variante é recusado.
- **Movimento.** `stock_movement` guarda `variant_id`, `location_id` e `lot_id` (nulo) com chave estrangeira, `kind` (`opening`, `adjustment`, `transferOut`, `transferIn`, `reversal`, `purchase`), `quantity_micros` e `value_cents` **assinados**, `occurred_on` (`AAAA-MM-DD`), `reason`, `transfer_id`, `reverses_movement_id`, `purchase_id` (nulo, com chave estrangeira, preenchido na entrada da compra e no estorno dela) e `version`, sempre 1. Não tem `updated_at` nem `archived_at`: duas triggers recusam `UPDATE` e `DELETE`, e o agregado só tem criação.
- **Saldo.** `stock_balance` é projeção, não agregado: fica fora de `AggregateType` e do `change_log`. Uma linha por ponto (variante, local, lote), com `id` textual `variantId|locationId|lotId ou -`, escrita na mesma transação do movimento por um único caminho. A soma dos movimentos por ponto é sempre igual à projeção.
- **Valor de saída.** Quantidade negativa toma a média do ponto (`exitValueCents`), arredondada ao centavo meio para cima, e o valor fica congelado no movimento; ponto zerado ou negativo devolve zero. Entrada (`opening` e ajuste positivo) exige o valor informado.
- **Transferência.** Uma operação grava duas linhas com o mesmo `transfer_id`, saída na origem e entrada no destino, com o mesmo valor, e origem e destino precisam ser diferentes.
- **Estorno.** `reversal` aponta para o original por `reverses_movement_id`, com índice único que garante um estorno por movimento. Estornar uma perna de transferência estorna a contraparte na mesma operação. Movimento com `purchase_id` só se estorna pelo estorno da compra.
- **Saldo de abertura.** `opening` grava quantidade e valor; o custo de referência da variante é sugestão da tela, nunca fonte de leitura do valor do estoque.

**Fornecedor e compra** ([compras](areas/compras.md), [ADR 0019](adr/0019-compra-e-obrigacao-como-fatos-imutaveis.md)).
- **Fornecedor.** `supplier` guarda `name` (1 a 120), `phone` e `email` com as regras do cliente, `notes` (até 2000), `search_text` (nome, e-mail e telefone), `archived_at` e `version`. Não tem dado pessoal para fins de anonimização.
- **Compra.** `purchase` guarda `supplier_id`, `occurred_on`, `reference` (até 60), `notes`, `freight_cents`, `discount_cents`, `gross_cents`, `total_cents` e `items` em JSON (de 1 a 100), com `version` sempre 1 e triggers que recusam `UPDATE` e `DELETE`. Cada item guarda `movementId`, `variantId`, `locationId`, `lotId`, `packagingLabel` (1 a 40), `packagingQuantityMicros`, `packageCountMicros`, `unitPriceCents` e os calculados `grossCents`, `freightCents`, `discountCents`, `quantityMicros` e `valueCents`, todos os valores em string de dígitos.
- **Conversão e rateio** (`purchaseTotals`). Total da linha = embalagens × preço por embalagem e quantidade na unidade base = embalagens × conteúdo da embalagem, os dois meio para cima; frete e desconto rateados pelo total da linha, piso em cada item e resto no último item com total de linha maior que zero; custo do item = linha + frete − desconto; total = soma das linhas + frete − desconto. Recusa quantidade que arredonda a zero, frete ou desconto sem total de linha, total menor ou igual a zero, item com custo negativo e valor acima de 2^53 − 1.
- **Obrigação.** `obligation` guarda `kind` (`purchase`), `purchase_id` com índice único, `amount_cents` (o total da compra) e `due_on`, append-only. Nasce na mesma operação da compra; na compra paga na hora, `due_on` é a data da compra e o pagamento é gravado junto.
- **Estado derivado.** A obrigação está cancelada quando existe `purchase_reversal` da compra, paga quando existe `obligationPayment` dela sem estorno, e aberta nos demais casos (`obligationStatus`). A compra mostra o mesmo estado, com "estornada" no lugar de "cancelada".
- **Estorno.** `purchase_reversal` guarda `purchase_id` com índice único, `occurred_on` e `reason` (1 a 200), append-only. Estorna cada movimento de estoque da compra pelo valor de entrada e o pagamento ativo, se houver.

**Conta financeira e movimento financeiro** ([finanças](areas/financas.md)).
- **Conta.** `financial_account` guarda `name` (1 a 60), `kind` (`cash`, `bank`, `pix`, `other`, editável), `notes`, `archived_at` e `version`. O saldo é a soma de `amount_cents` dos movimentos dela, calculada na leitura.
- **Movimento.** `financial_movement` guarda `account_id`, `kind` (`opening`, `transferOut`, `transferIn`, `obligationPayment`, `reversal`), `amount_cents` **assinado**, `occurred_on`, `reason`, `transfer_id`, `reverses_movement_id` (índice único), `obligation_id` (nulo) e `version`, sempre 1, com triggers append-only. Abertura tem valor diferente de zero, com sinal; transferência grava duas pernas com o mesmo `transfer_id`; `obligationPayment` é o valor inteiro da obrigação, negativo; estorno copia `obligation_id`, inverte o sinal e não pode ser estornado.

**Serviço e meta de margem** ([serviços](areas/servicos.md), [ADR 0020](adr/0020-servico-versionado-e-preco-sugerido-na-leitura.md)).
- **Serviço.** `service` guarda `name` (1 a 120), `category` (1 a 40 ou nulo, texto livre com sugestões do domínio e das já gravadas), `outsourced` (terceirizado, editável), `cost_cents` e `price_cents` (obrigatórios, de 0 ao teto, em `bigintInteger`), `target_margin_basis_points` (0 a 9999 ou nulo), `estimated_minutes` (1 a 9999 ou nulo), `notes` (até 2000), `search_text` (nome e categoria, fora do snapshot), `archived_at` e `version`, que é a versão exibida e a que o orçamento copia. Não tem dado pessoal.
- **Meta do ateliê.** `installation.target_margin_basis_points`, inteiro de 0 a 9999 com padrão 4000, alterado só por `installation.setTargetMargin`; a mesma meta não escreve.
- **Sugestão.** Não é gravada: a tela calcula por `pricingOf` (`packages/domain/src/pricing.ts`) com a meta própria do serviço ou, sem ela, a do ateliê. Abaixo da meta é preço menor que o sugerido; abaixo do custo é preço menor que o custo; a margem do preço é (preço − custo) ÷ preço em pontos-base, arredondada para baixo para nunca parecer maior que a real (preço abaixo da meta nunca mostra a margem da meta), e não existe com preço zero.

**Estoque e custo.** Uma aquisição aumenta quantidade e valor de material por lote; frete e desconto são alocados proporcionalmente ao valor bruto dos itens, com resíduo conservado. Reserva diminui somente disponibilidade e é recalculada por revisão ou cancelamento. Consumo pode levar o físico a negativo; usa custo provisório baseado no último custo conhecido ou informado, cria pendência e, quando uma aquisição cobre o déficit, registra ajuste de custo referenciando o consumo original. Seleção de lote sugere o mais antigo, mas permite escolha e divisão explícitas. Produto acabado usa valor e quantidade por variante para média ponderada; venda congela o custo das unidades baixadas. Retorno vendável reverte esse custo, não a média atual. OP distribui o custo total real ou ajustado entre unidades boas; saídas parciais usam custo provisório e ajuste ao fechar.

**Preço e margem.** Serviço guarda custo interno fixo separado do preço de venda e dos materiais. Preço sugerido é `costCents / (1 - targetMargin)` com meta em `[0, 1)`, arredondado para cima ao centavo para não ficar abaixo da meta, com a meta em pontos-base inteiros de 0 a 9999 (`suggestPrice(costCents, marginBasisPoints)`); nenhuma meta ou custo novo muda o preço praticado. Aprovação de orçamento congela custo e margem estimados; consumo, perda e despesa direta alteram a margem real por eventos posteriores. Terceirização real substitui a estimativa do mesmo componente, sem somar. Compra de material e produção de acabado elevam o estoque valorizado; o resultado reconhece custo no consumo da OS, na perda ou na venda do acabado, enquanto o caixa reconhece o pagamento da compra no momento financeiro.

## 3. Estados e comandos de negócio

**Estado:** cliente, perfil, modelo de medidas, medição, peça recebida, material, variante, local, lote, movimento de estoque, fornecedor, compra, obrigação, conta, movimento financeiro e serviço implementados; o resto previsto (F3 a F5).

**Cliente e perfil:** ativo ⇄ arquivado a qualquer momento; anonimizado é final e implica arquivado. Arquivar o que já está arquivado, ou desarquivar o que já está ativo, devolve a versão atual sem escrever. Perfil de cliente anonimizado é tratado como anonimizado. Nenhum comando aceita agregado anonimizado. Sem OS nem recebível, nada bloqueia a anonimização; a recusa com trabalho ou saldo aberto chega com essas tabelas.

**Peça recebida:** em custódia ⇄ devolvida pela edição de `returnedOn` (data ou `null`), e ativa ⇄ arquivada, a qualquer momento e com a regra de comando sem efeito. Cliente arquivado aceita peça nova; peça de cliente anonimizado é tratada como anonimizada e não aceita nenhum comando.

**Material e variante:** ativo ⇄ arquivado a qualquer momento, com a mesma regra de comando sem efeito. Material arquivado aceita variante nova, e variante de material arquivado continua aceitando comando; nenhum dos dois é apagado.

**Local de estoque e lote:** ativo ⇄ arquivado a qualquer momento, com a regra de comando sem efeito. Local arquivado sai das escolhas da tela e continua aceitando comando; lote só nasce em variante que controla lote.

**Movimento de estoque:** não tem estado. Nasce com `version` 1 e nunca muda; a única evolução possível é um estorno que o referencia, e cada movimento aceita um só.

**Serviço:** ativo ⇄ arquivado a qualquer momento, com a regra de comando sem efeito. Arquivado sai da lista do dia a dia e continua aceitando comando.

**Fornecedor e conta financeira:** ativo ⇄ arquivado a qualquer momento, com a regra de comando sem efeito. Arquivado sai das escolhas da tela e continua aceitando comando.

**Compra:** fato sem estado próprio. Mostra paga, a pagar ou estornada conforme a obrigação e o estorno; estornada é final.

**Obrigação de compra:** aberta → paga pela quitação; paga → aberta pelo estorno da quitação; aberta ou paga → cancelada pelo estorno da compra, que é final. O estado é derivado dos fatos, nunca gravado.

**Movimento financeiro:** como o de estoque, sem estado; aceita um estorno, e o estorno não se estorna.

**Modelo de medidas e medição:** ativo ⇄ arquivado a qualquer momento, com a mesma regra de comando sem efeito. Modelo arquivado some da escolha na tela de registrar, mas continua aceitando medição pelos comandos; perfil arquivado também aceita medição. Medição de perfil cujo cliente foi anonimizado é tratada como anonimizada e não aceita nenhum comando.

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
  aggregateType: string; // "installation" | "device" | "client" | "profile" | "measurementTemplate" | "measurement" | "receivedItem" | "material" | "materialVariant" | "stockLocation" | "stockLot" | "stockMovement" | "supplier" | "purchase" | "purchaseReversal" | "obligation" | "financialAccount" | "financialMovement" | "service"
  aggregateId: string;
  baseVersion: number | null; // null obrigatório na criação
  occurredAt: string; // ISO 8601 com fuso
  command: string; // "installation.setAtelierName" | "device.rename" | "client.*" | "profile.*" | "measurementTemplate.*" | "measurement.*" | "receivedItem.*" | "material.*" | "materialVariant.*" | "stockLocation.*" | "stockLot.*" | "stockMovement.create" | "stockMovement.transfer" | "stockMovement.reverse" | "supplier.*" | "purchase.create" | "purchase.reverse" | "obligation.pay" | "financialAccount.*" | "financialMovement.create" | "financialMovement.transfer" | "financialMovement.reverse" | "service.*" | "installation.setTargetMargin"
  payload: unknown;
};
type QuarantineReason =
  | "epoch"
  | "opIdReused"
  | "deviceMismatch"
  | "unknownCommand"
  | "invalidPayload"
  | "aggregateNotFound"
  | "aggregateExists"
  | "aggregateAnonymized"
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

**`sync.push({ operations })`**, de 1 a 100 itens por chamada; lista vazia ou maior responde 400 `BAD_REQUEST` sem processar nada. Exige sessão do dono, instalação `ready` e dispositivo aprovado pelos cabeçalhos `x-costura-device-id` e `x-costura-device-secret`. Cada item é validado sozinho: item fora do formato de `Operation` vira quarentena `invalidEnvelope` sem barrar os outros, gravada em `operation` quando traz `opId` UUID válido e só auditada, com `opId: null` na resposta, quando não traz. Cada operação roda numa transação curta, na ordem recebida, e decide nesta ordem: `opId` já gravado (mesmo SHA-256 do JSON canônico devolve o resultado gravado; conteúdo diferente vira `opIdReused` só na auditoria, sem tocar o original), `deviceId` diferente do autenticado, epoch diferente, comando ou tipo desconhecido, payload inválido e então, conforme o tipo do comando no registro. Criação: `baseVersion` diferente de `null` ou `aggregateId` que não é UUID vira `invalidEnvelope`, id existente vira `aggregateExists`, pai inexistente vira `aggregateNotFound` e pai anonimizado vira `aggregateAnonymized`. Edição: agregado inexistente vira `aggregateNotFound`, anonimizado vira `aggregateAnonymized` e, por fim, versão-base diferente abre conflito com valores locais e atuais lado a lado; `baseVersion: null` nunca coincide com a versão atual e o conflito guarda o `null`. O conflito compara a versão do agregado inteiro, não campo a campo. O `op_hash` sai como `redacted` em vez do hash quando o agregado da operação já foi redigido, quando o desfecho é `aggregateAnonymized` ou quando a operação vai para qualquer quarentena e o comando, procurado pelo nome no registro sem depender do `aggregateType` enviado, é de agregado com dado pessoal (`client`, `profile`, `measurement` ou `receivedItem`, em `personalDataAggregates`), inclusive item fora do formato cujo `command` indica esse agregado; a repetição dessas operações responde `opIdReused` ([DEC-82](PRD.md#96-plataforma-acesso-e-operação)). Na criação, perfil ou modelo inexistente viram `aggregateNotFound`, e a rejeição pode levar a mensagem da procedure direta. Aceita aplica, incrementa `version` e grava o snapshot no log de mudanças. Quarentena e conflito também gravam resultado e evento de auditoria; nada é descartado. Mudanças independentes não param por causa de um conflito. Comandos de fato (venda, pagamento, consumo) aceitarão concorrência e criarão exceção de saldo; edições de campos sobre versão-base diferente viram conflito, nunca última gravação vence às cegas. Os arquivos de mídia não viajam no envelope: a operação carrega só os hashes no payload, e os bytes vão antes pela rota de mídia.

**`sync.pull({ cursor, epoch, limit })`**: cursor em string decimal (`"0"` no início), até 500 mudanças por página com `hasMore`. `epoch` é `string | null`; `null` (primeiro sync do aparelho) ou epoch diferente do servidor devolve `rebase: true` e leitura desde o início. `serverVersion` é o `version` do `apps/server/package.json`. Hoje o log traz a instalação `{ id, atelierName, state, targetMarginBasisPoints, version }`, dispositivos `{ id, name, status, version, createdAt, approvedAt, revokedAt }`, sem segredos, clientes `{ id, kind, name, phone, secondaryPhone, email, address, notes, archivedAt, anonymizedAt, createdAt, version }`, perfis `{ id, clientId, name, notes, archivedAt, createdAt, version }`, modelos de medidas `{ id, name, fields, archivedAt, createdAt, version }`, medições `{ id, profileId, templateId, templateName, templateVersion, takenOn, notes, fields, archivedAt, createdAt, version }` peças recebidas `{ id, clientId, description, condition, quantity, accessories, notes, photos, receivedOn, expectedReturnOn, returnedOn, archivedAt, createdAt, version }`, materiais `{ id, name, category, notes, archivedAt, createdAt, version }` variantes de material `{ id, materialId, name, code, baseUnit, displayPrecision, referenceCostCents, minQuantityMicros, targetQuantityMicros, packaging, photo, tracksLots, archivedAt, createdAt, version }`, locais de estoque `{ id, name, notes, archivedAt, createdAt, version }`, lotes `{ id, variantId, label, notes, archivedAt, createdAt, version }` movimentos de estoque `{ id, variantId, locationId, lotId, kind, quantityMicros, valueCents, occurredOn, reason, transferId, reversesMovementId, purchaseId, createdAt, version }`, fornecedores `{ id, name, phone, email, notes, archivedAt, createdAt, version }`, compras `{ id, supplierId, occurredOn, reference, notes, freightCents, discountCents, grossCents, totalCents, items, createdAt, version }`, obrigações `{ id, kind, purchaseId, amountCents, dueOn, createdAt, version }`, estornos de compra `{ id, purchaseId, occurredOn, reason, createdAt, version }`, contas financeiras `{ id, name, kind, notes, archivedAt, createdAt, version }`, movimentos financeiros `{ id, accountId, kind, amountCents, occurredOn, reason, transferId, reversesMovementId, obligationId, createdAt, version }` e serviços `{ id, name, category, outsourced, costCents, priceCents, targetMarginBasisPoints, estimatedMinutes, notes, archivedAt, createdAt, version }`, com dinheiro e quantidade como inteiro em string. Snapshot gravado antes da migration que acrescentou um campo não traz o campo (a instalação sem `targetMarginBasisPoints` até a próxima escrita dela, a variante anterior à `0008` sem `tracksLots`): o consumidor aplica o padrão do domínio (`defaultTargetMarginBasisPoints` e `false`). Os demais agregados entram até espelhar o resto do catálogo, estoque, OS, OP, vendas, finanças e documentos.

**`sync.resolve({ opId, conflictId, choice, values?, reason })`**: `keepLocal` aplica os valores locais sobre a versão atual, `keepServer` fecha sem mudar e `merge` valida e aplica `values`; motivo de 1 a 200 caracteres, idempotente por `opId`, uma única vez por conflito (`CONFLICT` depois) e auditado; conflito inexistente responde `NOT_FOUND` antes de gravar nada, e a operação grava o tipo e o id do agregado do conflito. Devolve `{ choice, conflictId, version }`. Aceita dispositivo aprovado ou acesso local com sessão, como `sync.pending()`, que devolve `{ conflicts, quarantined }`: conflitos abertos (com `baseVersion` possivelmente `null`) e quarentenas `{ opId, command, occurredAt, reason }` em ordem de chegada, incluindo as `opIdReused` lidas da auditoria, menos as de `opId` que já está em quarentena na tabela `operation` com `op_hash` `redacted` (o reenvio idêntico dessas vira `opIdReused`, e a operação aparece uma vez, com o motivo original; com hash real, toda repetição listada é conteúdo diferente). Sessão remota sem dispositivo recebe `UNAUTHORIZED` nas duas.

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
| `devices.approve`, `devices.revoke` | `{ status, version }` | igual |

Os testes exercitam o Hono autenticado sobre SQLite real, nunca banco simulado em memória.

**Cliente e perfil.** Cada comando é definido uma vez no registro do sync e exposto como procedure direta que grava a operação com `aggregate_type` e `aggregate_id` ([agregados](areas/agregados.md)). Todas exigem sessão do dono e instalação `ready`, em qualquer acesso, menos `clients.anonymize`, só no acesso local:

| Procedure | Comando | Entrada | Resposta |
|---|---|---|---|
| `clients.list` | leitura | `{ query?, archived = false, offset = 0 }` | `{ items: { id, kind, name, phone, profileCount, archivedAt, anonymizedAt, updatedAt, version }[], nextOffset }`, 50 por página, ordem por `search_text`; `archived: true` traz só arquivados, anonimizados inclusive; `profileCount` conta perfis ativos |
| `clients.get` | leitura | `{ clientId }` | `{ client: snapshot com updatedAt, profiles: snapshot[] }`, perfis arquivados inclusive, ordem por nome |
| `clients.create` | `client.create` | `{ clientId, opId, kind, name, phone?, secondaryPhone?, email?, address?, notes? }` | `{ id, version }` |
| `clients.update` | `client.update` | `{ clientId, baseVersion, opId, patch }` | `{ version }` |
| `clients.archive`, `clients.unarchive` | `client.archive`, `client.unarchive` | `{ clientId, baseVersion, opId }` | `{ version }` |
| `clients.anonymize` | `client.anonymize` (sem comando de sync) | `{ clientId, baseVersion, opId }` | `{ version }` |
| `profiles.create` | `profile.create` | `{ profileId, clientId, opId, name, notes? }` | `{ id, version }` |
| `profiles.update`, `profiles.archive`, `profiles.unarchive` | `profile.*` | `{ profileId, baseVersion, opId, patch? }` | `{ version }` |

Erros: versão-base diferente responde `CONFLICT` `Versão desatualizada` com `data: { current, currentVersion }`; id existente, `CONFLICT` `Registro já existe`; inexistente, `NOT_FOUND` `Cliente não encontrado` ou `Perfil não encontrado`; cliente anonimizado (inclusive em comando de perfil), `PRECONDITION_FAILED` `Cliente anonimizado`; anonimizar fora do acesso local, `FORBIDDEN`. Os literais moram em `packages/api/src/command-messages.ts`, usados pelo servidor e por `apps/web/src/lib/client-command-error.ts`, que distingue versão velha e registro já gravado pela mensagem e anonimizado pelo código; na tela de novo cliente, `Registro já existe` do próprio id segue para a ficha.

**Modelo de medidas e medição.** Mesmo registro e mesmas procedures diretas de cliente e perfil ([agregados](areas/agregados.md)), todas com sessão do dono e instalação `ready`, em qualquer acesso:

| Procedure | Comando | Entrada | Resposta |
|---|---|---|---|
| `measurementTemplates.list` | leitura | `{}` | `{ items: (snapshot & { updatedAt })[] }`, arquivados inclusive, ordem por `name` e `id` |
| `measurementTemplates.create` | `measurementTemplate.create` | `{ templateId, opId, name, fields: { id, label }[] }` | `{ id, version }` |
| `measurementTemplates.update` | `measurementTemplate.update` | `{ templateId, baseVersion, opId, patch: { name?, fields? } }` | `{ version }` |
| `measurementTemplates.archive`, `unarchive` | `measurementTemplate.*` | `{ templateId, baseVersion, opId }` | `{ version }` |
| `measurements.list` | leitura | `{ clientId }` | `{ items: (snapshot & { updatedAt })[] }` de todos os perfis, arquivadas inclusive, na ordem total |
| `measurements.create` | `measurement.create` | `{ measurementId, opId, profileId, templateId, templateName, templateVersion, takenOn, notes?, fields }` | `{ id, version }` |
| `measurements.update` | `measurement.update` | `{ measurementId, baseVersion, opId, patch: { takenOn?, notes?, fields? } }` | `{ version }` |
| `measurements.archive`, `unarchive` | `measurement.*` | `{ measurementId, baseVersion, opId }` | `{ version }` |

Erros: os de cliente e perfil valem aqui, com `NOT_FOUND` `Perfil não encontrado`, `Modelo de medidas não encontrado` ou `Medição não encontrada` e `PRECONDITION_FAILED` `Cliente anonimizado` para medição de perfil de cliente anonimizado. Na web, `Registro já existe` do próprio id numa tela de criação leva à correção da medição ou ao editor do modelo gravado, com aviso.

**Peça recebida.** Mesmo registro e mesmas procedures diretas dos outros agregados ([agregados](areas/agregados.md)), todas com sessão do dono e instalação `ready`, em qualquer acesso:

| Procedure | Comando | Entrada | Resposta |
|---|---|---|---|
| `receivedItems.list` | leitura | `{ clientId }` | `{ items: (snapshot & { updatedAt })[] }`, arquivadas inclusive, na ordem de `received_on`, `created_at` e `id` decrescentes |
| `receivedItems.create` | `receivedItem.create` | `{ receivedItemId, opId, clientId, description, condition, quantity, receivedOn, accessories?, notes?, expectedReturnOn?, photos? }` | `{ id, version }` |
| `receivedItems.update` | `receivedItem.update` | `{ receivedItemId, baseVersion, opId, patch }`, com qualquer campo da criação menos `clientId`, mais `returnedOn` | `{ version }` |
| `receivedItems.archive`, `unarchive` | `receivedItem.*` | `{ receivedItemId, baseVersion, opId }` | `{ version }` |

Erros: os de cliente valem aqui, com `NOT_FOUND` `Cliente não encontrado` na criação e na lista e `Peça recebida não encontrada` nas edições, e `PRECONDITION_FAILED` `Cliente anonimizado`. Na web, `Registro já existe` do próprio id na tela de receber leva à página da peça, com aviso.

**Material e variante de material.** Mesmo registro e mesmas procedures diretas dos outros agregados ([agregados](areas/agregados.md), [catálogo de materiais](areas/catalogo.md)), todas com sessão do dono e instalação `ready`, em qualquer acesso:

| Procedure | Comando | Entrada | Resposta |
|---|---|---|---|
| `materials.list` | leitura | `{ query?, category?, archived = false, offset = 0 }` | `{ items: { id, name, category, variantCount, archivedAt, updatedAt, version }[], nextOffset }`, 50 por página; `query` casa material e variante, `category` filtra exata e `""` traz os sem categoria |
| `materials.categories` | leitura | `{}` | `{ categories }` das categorias gravadas em material não arquivado, em ordem alfabética |
| `materials.get` | leitura | `{ materialId }` | `{ material: snapshot com updatedAt, variants: (snapshot & { updatedAt })[] }`, variantes arquivadas inclusive |
| `materials.create` | `material.create` | `{ materialId, opId, name, category?, notes? }` | `{ id, version }` |
| `materials.update` | `material.update` | `{ materialId, baseVersion, opId, patch }` | `{ version }` |
| `materials.archive`, `materials.unarchive` | `material.*` | `{ materialId, baseVersion, opId }` | `{ version }` |
| `materialVariants.create` | `materialVariant.create` | `{ variantId, materialId, opId, name, baseUnit, displayPrecision, tracksLots?, code?, referenceCostCents?, minQuantityMicros?, targetQuantityMicros?, packaging?, photo? }` | `{ id, version }` |
| `materialVariants.update` | `materialVariant.update` | `{ variantId, baseVersion, opId, patch }`, com qualquer campo da criação menos `materialId`, `baseUnit` e `tracksLots` | `{ version }` |
| `materialVariants.archive`, `unarchive` | `materialVariant.*` | `{ variantId, baseVersion, opId }` | `{ version }` |
| `materialVariants.byCode` | leitura | `{ code }` | `{ items: { id, materialId, materialName, name, code }[] }`, até 10, comparação sem caixa, para o aviso de código repetido e depois para a leitura por câmera |

Erros: os de sempre, com `NOT_FOUND` `Material não encontrado` e `Variante não encontrada`; não há `PRECONDITION_FAILED` de anonimização. No push, material inexistente na criação da variante vira `aggregateNotFound`, e unidade fora da lista, precisão fora de 0 a 6, valor acima do teto, embalagem pela metade ou patch que só traz `baseUnit` ou `tracksLots` viram `invalidPayload`.

**Local de estoque, lote e movimento.** Mesmo registro e mesmas procedures diretas dos outros agregados ([agregados](areas/agregados.md), [estoque](areas/estoque.md)), todas com sessão do dono e instalação `ready`, em qualquer acesso:

| Procedure | Comando | Entrada | Resposta |
|---|---|---|---|
| `stockLocations.list` | leitura | `{ archived = false }` | `{ items: (snapshot & { updatedAt })[] }`, ordem por nome e id |
| `stockLocations.create` | `stockLocation.create` | `{ locationId, opId, name, notes? }` | `{ id, version }` |
| `stockLocations.update`, `archive`, `unarchive` | `stockLocation.*` | `{ locationId, baseVersion, opId, patch? }` | `{ version }` |
| `stockLots.list` | leitura | `{ variantId, archived = false }` | `{ items: (snapshot & { updatedAt })[] }` |
| `stockLots.create` | `stockLot.create` | `{ lotId, variantId, opId, label, notes? }` | `{ id, version }` |
| `stockLots.update`, `archive`, `unarchive` | `stockLot.*` | `{ lotId, baseVersion, opId, patch? }` | `{ version }` |
| `stockBalances.list` | leitura | `{ query?, locationId?, offset = 0 }` | `{ items: { variantId, materialId, materialName, variantName, code, baseUnit, displayPrecision, tracksLots, referenceCostCents, quantityMicros, valueCents }[], nextOffset }`, 50 por página, uma linha por variante **ativa** mesmo sem movimento; com `locationId`, só as que têm saldo naquele local |
| `stockBalances.get` | leitura | `{ variantId }` | `{ points: { locationId, locationName, lotId, lotLabel, quantityMicros, valueCents }[] }`, sem os pontos zerados |
| `stockMovements.list` | leitura | `{ variantId }` | `{ items: (snapshot & { locationName, lotLabel, reversedByMovementId })[] }`, ordem por `occurredOn`, `createdAt` e `id` decrescentes |
| `stockMovements.create` | `stockMovement.create` | `{ movementId, opId, variantId, locationId, lotId?, kind, quantityMicros, valueCents?, occurredOn, reason? }`, só `opening` e `adjustment` | `{ id, version }` |
| `stockMovements.transfer` | `stockMovement.transfer` | `{ movementId, inboundId, opId, variantId, fromLocationId, toLocationId, lotId?, quantityMicros, occurredOn, reason? }` | `{ id, version }` |
| `stockMovements.reverse` | `stockMovement.reverse` | `{ movementId, opId, reversesMovementId, counterpartId?, occurredOn, reason }` | `{ id, version }` |

Quantidade e valor de movimento viajam como inteiro **com sinal** em string (`signedMoneyCentsSchema` e `signedQuantityMicrosSchema` em `packages/api/src/schemas.ts`), com a faixa conferida dentro do mesmo `refine` do regex.

Erros: os de sempre, com `NOT_FOUND` `Local não encontrado`, `Lote não encontrado`, `Variante não encontrada` e `Movimento não encontrado`; não há `PRECONDITION_FAILED` de anonimização. `CreateRejection` ganhou a razão `aggregateExists`, que a procedure direta traduz em `CONFLICT` `Registro já existe` e o push grava como quarentena `aggregateExists`: é assim que o segundo estorno do mesmo movimento e o id de entrada de transferência já usado são recusados pelos dois caminhos. No push, `kind` fora de `opening` e `adjustment` em `stockMovements.create`, valor acima do teto, quantidade zero, ajuste sem motivo, ajuste negativo com valor e ajuste positivo sem valor viram `invalidPayload`. O segundo id de uma operação de duas linhas (`inboundId` da transferência, `counterpartId` do estorno) igual ao próprio id da operação também vira `aggregateExists`. `stockMovements.reverse` de movimento com `purchaseId` responde `NOT_FOUND` `Movimento de compra se estorna pela compra` (`aggregateNotFound` no push).

**Fornecedor, compra e obrigação.** Mesmo registro e mesmas procedures diretas dos outros agregados ([agregados](areas/agregados.md), [compras](areas/compras.md)), todas com sessão do dono e instalação `ready`, em qualquer acesso:

| Procedure | Comando | Entrada | Resposta |
|---|---|---|---|
| `suppliers.list` | leitura | `{ query?, archived = false, offset = 0 }` | `{ items: (snapshot & { updatedAt })[], nextOffset }`, 50 por página, ordem por `search_text` e `id` |
| `suppliers.options` | leitura | sem entrada | `{ items: { id, name, archivedAt }[] }`, todos os fornecedores, arquivados inclusive, para os seletores |
| `suppliers.create` | `supplier.create` | `{ supplierId, opId, name, phone?, email?, notes? }` | `{ id, version }` |
| `suppliers.update`, `archive`, `unarchive` | `supplier.*` | `{ supplierId, baseVersion, opId, patch? }` | `{ version }` |
| `purchases.list` | leitura | `{ supplierId?, offset = 0 }` | `{ items: { id, supplierId, supplierName, occurredOn, reference, itemCount, totalCents, status, dueOn }[], nextOffset }`, `status` `paid`, `open` ou `reversed`, ordem por `occurredOn`, `createdAt` e `id` decrescentes |
| `purchases.get` | leitura | `{ purchaseId }` | `{ purchase, items, obligation, reversal }`: snapshot com `supplierName`; itens enriquecidos com `materialName`, `variantName`, `baseUnit`, `displayPrecision`, `locationName` e `lotLabel`; obrigação `{ id, amountCents, dueOn, status, payment }`, com `payment` `{ movementId, accountId, accountName, occurredOn }` ou nulo; estorno `{ id, occurredOn, reason, createdAt }` ou nulo |
| `purchases.create` | `purchase.create` | `{ purchaseId, opId, supplierId, occurredOn, reference?, notes?, freightCents = "0", discountCents = "0", items, obligationId, payment }`, cada item `{ movementId, variantId, locationId, lotId?, packagingLabel, packagingQuantityMicros, packageCountMicros, unitPriceCents }` e `payment` `{ kind: "now", accountId, movementId }` ou `{ kind: "later", dueOn }` | `{ id, version }` |
| `purchases.reverse` | `purchase.reverse` | `{ reversalId, opId, purchaseId, occurredOn, reason, movementIds, paymentReversalId }`, um id de `movementIds` por item, na ordem dos itens | `{ id, version }` |
| `obligations.list` | leitura | `{ status = "open", offset = 0 }` | `{ items: { id, purchaseId, supplierId, supplierName, reference, purchaseOccurredOn, amountCents, dueOn, status, paidOn, paidAccountName, paymentMovementId }[], nextOffset }`, abertas por `dueOn` crescente, as outras decrescente |
| `obligations.pay` | `obligation.pay` | `{ movementId, opId, obligationId, accountId, occurredOn }` | `{ id, version }` |
| `materialVariants.search` | leitura | `{ query?, offset = 0 }` | `{ items: { id, materialId, materialName, name, code, baseUnit, displayPrecision, tracksLots, packaging }[], nextOffset }`, variantes e materiais ativos, 50 por página |

Erros: `NOT_FOUND` `Fornecedor não encontrado`, `Compra não encontrada` (também com `movementIds` de tamanho diferente dos itens), `Obrigação não encontrada` e `Obrigação cancelada` (compra estornada), mais os de variante, local, lote e conta; `CONFLICT` `Compra já estornada` e `Obrigação já paga` (`aggregateExists` no push) e `Registro já existe` para id de movimento, obrigação ou pagamento já usado. No push, ids repetidos no payload, total zero, frete ou desconto sem total de linha, quantidade que arredonda a zero e valor fora do formato viram `invalidPayload`; o `refine` do objeto só roda com os campos válidos (`whenShapeIsValid`).

**Conta financeira e movimento financeiro.** Mesmo registro e mesmas procedures diretas ([finanças](areas/financas.md)):

| Procedure | Comando | Entrada | Resposta |
|---|---|---|---|
| `financialAccounts.list` | leitura | `{ archived = false }` | `{ items: (snapshot & { updatedAt, balanceCents })[] }`, ordem por nome e id |
| `financialAccounts.create` | `financialAccount.create` | `{ accountId, opId, name, kind, notes? }` | `{ id, version }` |
| `financialAccounts.update`, `archive`, `unarchive` | `financialAccount.*` | `{ accountId, baseVersion, opId, patch? }` | `{ version }` |
| `financialMovements.list` | leitura | `{ accountId }` | `{ items: (snapshot & { reversedByMovementId, purchaseId, supplierName, purchaseReference })[] }`, até 200, ordem por `occurredOn`, `createdAt` e `id` decrescentes |
| `financialMovements.create` | `financialMovement.create` | `{ movementId, opId, accountId, kind: "opening", amountCents, occurredOn, reason? }` | `{ id, version }` |
| `financialMovements.transfer` | `financialMovement.transfer` | `{ movementId, inboundId, opId, fromAccountId, toAccountId, amountCents, occurredOn, reason? }` | `{ id, version }` |
| `financialMovements.reverse` | `financialMovement.reverse` | `{ movementId, opId, reversesMovementId, counterpartId?, occurredOn, reason }` | `{ id, version }` |

Erros: `NOT_FOUND` `Conta não encontrada`, `Movimento não encontrado` e `Estorno não se estorna`; `CONFLICT` `Movimento já estornado`. No push, abertura zero, transferência para a mesma conta e valor fora do formato viram `invalidPayload`.

**Serviço e meta de margem.** Mesmo registro e mesmas procedures diretas dos outros agregados ([agregados](areas/agregados.md), [serviços](areas/servicos.md)), todas com sessão do dono e instalação `ready`, em qualquer acesso:

| Procedure | Comando | Entrada | Resposta |
|---|---|---|---|
| `services.list` | leitura | `{ query?, category?, archived = false, offset = 0 }` | `{ items: (snapshot & { updatedAt })[], nextOffset }`, 50 por página, ordem por `search_text` e `id`; `category` filtra exata e `""` traz os sem categoria |
| `services.categories` | leitura | `{}` | `{ categories }` dos serviços não arquivados, em ordem alfabética |
| `services.get` | leitura | `{ serviceId }` | `snapshot & { updatedAt }` |
| `services.create` | `service.create` | `{ serviceId, opId, name, costCents, priceCents, category?, outsourced = false, targetMarginBasisPoints?, estimatedMinutes?, notes? }` | `{ id, version }` |
| `services.update` | `service.update` | `{ serviceId, baseVersion, opId, patch }`, com qualquer campo da criação; `null` limpa categoria, meta própria, duração e notas | `{ version }` |
| `services.archive`, `services.unarchive` | `service.*` | `{ serviceId, baseVersion, opId }` | `{ version }` |
| `pricing.settings` | leitura | `{}` | `{ targetMarginBasisPoints, version }`, com a versão da instalação |
| `pricing.setTargetMargin` | `installation.setTargetMargin` | `{ baseVersion, opId, targetMarginBasisPoints }` | `{ version }`; a mesma meta devolve a versão atual |

Erros: os de sempre, com `NOT_FOUND` `Serviço não encontrado`; não há `PRECONDITION_FAILED`. No push, custo ou preço fora do formato, negativo ou acima do teto, meta fora de 0 a 9999, duração fora de 1 a 9999 e patch vazio viram `invalidPayload`; `installation.setTargetMargin` com id que não é o da instalação vira `aggregateNotFound`.

**Rotas de mídia** ([mídia](areas/midia.md)). Fora do oRPC, montadas em `/api/media` antes de `/rpc`, com sessão do dono e instalação `ready` (`isAtLeast`), em qualquer acesso, e fora do evlog:

| Rota | Respostas |
|---|---|
| `PUT /api/media/:hash` (corpo cru) | 401 `Sessão necessária`; 412 `Instalação ainda no wizard`; 400 `Hash inválido`; 413 `Arquivo maior que 4 MB` (pelo `Content-Length` ou contando o streaming); 415 `Formato não aceito` (tipo pelos bytes); 422 `Hash não confere`; 200 `{ byteSize, hash, mime }` com linha e arquivo presentes, renovando `uploaded_at`; 201 gravado; 500 `Não foi possível gravar a foto` sem linha nova |
| `GET /api/media/:hash` | 401; 412; 404 `Foto não encontrada` sem linha ou sem arquivo, conferido antes do 304; 304 por `If-None-Match` com `ETag` e `Cache-Control`; 500 `Não foi possível ler a foto` registrando só o código do erro; 200 com `Content-Type` da linha, `Content-Length`, `Cache-Control: private, max-age=31536000, immutable`, `ETag` igual ao hash entre aspas, `X-Content-Type-Options: nosniff` e `Content-Disposition` `inline` ou, com `?download=1`, `attachment` com o nome `foto-` seguido dos 12 primeiros caracteres do hash |

A web envia os dois arquivos de cada foto antes do comando; 401 encerra a sessão (`sessionEnded` reconhece `PhotoCaptureError` com esse status), falha de rede, 5xx e 412 oferecem nova tentativa, e 413, 415 e 422 pedem outra foto.

Dispositivo isolado por qualquer tempo faz rebase do snapshot completo sem apagar a outbox. Atualização do cliente migra Dexie e outbox antes do sync; operações incompatíveis vão para quarentena. Restauração incrementa o epoch e toda operação antiga é retida para reaplicação manual, nunca mesclada automaticamente ([ADR 0004](adr/0004-backup-epoch-e-cofre-por-dispositivo.md)).

**Mídia.** Upload autenticado por hash SHA-256 com tipo detectado pelos bytes (JPEG ou WebP) e limite de 4 MiB; o arquivo é gravado de forma atômica e só então a linha é registrada (rotas acima, §2 e [ADR 0016](adr/0016-midia-enderecada-por-conteudo.md)). O original é otimizado na captura: WebP onde o navegador gera e JPEG onde não gera (Safari), com 2048 px no lado maior e qualidade 0,82, e ganha miniatura de 512 px e 0,80 no mesmo formato; recodificar pelo canvas descarta EXIF e GPS. O cache offline de miniaturas e imagens vistas chega com o espelho da F6.

**PDF.** Fontes e templates versionados empacotados com a PWA; a emissão gera bytes finais, SHA-256, dados congelados e documento com versão. O servidor nunca regenera documento antigo com template novo ([ADR 0008](adr/0008-documentos-emitidos-imutaveis.md)).

## 5. Segurança e armazenamento local

**Estado:** conta, bootstrap, dispositivos e auditoria implementados no servidor; login, wizard e guardas de rota implementados na web (§0); cofre e PWA offline previstos (F6).

**Conta.** Better Auth mantém uma única conta de dono com o plugin `username` (3 a 30 caracteres, normalizados em minúsculas) e senha de 10 a 128 caracteres. O e-mail técnico exigido pela base de e-mail e senha é local (`owner@costura-pro.local`) e não é canal de recuperação. Cadastro público fica desativado após o onboarding, garantido no servidor e não só na interface. Sessão server-side usa o cookie `costura-pro.session_token` (`advanced.cookiePrefix`, para não colidir com outro app em `localhost`), `HttpOnly` e `SameSite=Lax`, com `baseURL` `http://127.0.0.1:<PORT>` e `trustedOrigins` `http://127.0.0.1:*`, `http://localhost:*` e `CANONICAL_ORIGIN`. O Better Auth calcula `Secure` uma vez por instância, então roda com `useSecureCookies: false` e o servidor acrescenta `Secure` a todo `Set-Cookie` quando o Host é o da origem canônica; no loopback HTTP o cookie sai sem `Secure`, que WebKit e libsoup descartariam. O Hono repassa ao Better Auth só a allowlist `/sign-in/username`, `/sign-out`, `/get-session`, `/change-password`, `/list-sessions`, `/revoke-session`, `/revoke-other-sessions` e `/ok`; qualquer outra rota sob `/api/auth` responde 404 sem chegar ao Better Auth. O rate limit do Better Auth fica na tabela `rate_limit` (`storage: "database"`), com 5 tentativas por 60 s em `/sign-in/username` por IP lido só de `cf-connecting-ip` (`advanced.ipAddress.ipAddressHeaders`); requisições locais não trazem o cabeçalho e dividem um único balde, e o Better Auth agrupa IPv6 por prefixo /64 (`advanced.ipAddress.ipv6Subnet`, padrão 64). Além dele, o bloqueio remoto global: a cada 5 falhas remotas seguidas (401), o login remoto responde 429 `Muitas tentativas. Tente de novo mais tarde.` com `Retry-After` por 1 min, dobrando até 30 min; o sucesso remoto zera a contagem e o acesso local nunca consulta nem altera o bloqueio. A tentativa remota é reservada antes de chegar ao Better Auth, numa transação que já a conta como falha e grava o bloqueio no múltiplo de 5; a resposta acerta a conta (200 zera, 401 mantém, qualquer outra devolve a reserva), então tentativas paralelas não passam do limite. Todo resultado de login vira evento de auditoria sem senha nem username tentado, uma sequência de recusas por bloqueio gera um único evento `locked`, e os erros não revelam se o usuário existe ([ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md)). [Better Auth: plugin Username](https://better-auth.com/docs/plugins/username), [Better Auth: rate limit](https://better-auth.com/docs/concepts/rate-limit), [Better Auth: hooks](https://better-auth.com/docs/concepts/hooks).

**Bootstrap da conta (F2):**

- A instalação é um registro singleton criado no boot, com epoch UUIDv4. O dono nasce só por `installation.createOwner` no acesso local, com compare-and-set do passo `atelier` para `account` e `auth.api.signUpEmail` no servidor (`autoSignIn: false`); o concorrente perde com `PRECONDITION_FAILED`, e a falha devolve o passo para `atelier` com evento `owner.bootstrap_failed`. `databaseHooks.user.create.before` recusa qualquer segundo usuário. Nenhuma rota HTTP de cadastro responde.
- O username chega normalizado (espaços nas pontas fora e minúsculas) antes de virar `username` e `name` do usuário.
- O adapter do Better Auth grava usuário e conta sem transação: a falha do `createOwner` apaga usuários sem conta `credential` antes de devolver o passo, e o boot reconcilia uma instalação em `account` sem dono, adotando a única conta com credencial ou, sem nenhuma, apagando órfãos e voltando para `atelier`; os dois caminhos geram evento com `recovered: true`.
- Cliente web com `usernameClient({ displayUsername: false })` e `signIn.username`; `/is-username-available` fica fechado pela allowlist.
- A política de cookie por origem está implementada e testada nas duas (HTTP local e Host canônico) desde a F0 e continua com o login por username.
- O wizard é uma máquina de estados retomável (`empty → atelier → account → recovery → backup → ready`) com as procedures `installation.status` (qualquer acesso; devolve `{ access, state }`, com `access` `local` ou `remote`), `installation.details` (acesso local; sem sessão só em `empty` e `atelier`; devolve `{ atelierName, backupFolder, backupTestedAt, version }`, com `backupTestedAt` em ISO 8601; remoto recebe `FORBIDDEN` e local sem sessão a partir de `account` recebe `UNAUTHORIZED`), `setAtelierName` (acesso local; sem sessão só em `empty` e `atelier`, checagem feita antes da repetição por `opId`), `createOwner`, `generateRecoveryCodes` e `confirmRecoveryCodes`, `listFolders` e `testBackupFolder` (a partir de `recovery`) e `finish` (de `backup` para `ready`). Passo fora de ordem responde `PRECONDITION_FAILED` com o estado, e toda procedure de negócio exige `ready`. `ready` exige pasta de backup testada: o dono escolhe a pasta no acesso local, num navegador de pastas alimentado pelo servidor que lista o que a conta do serviço enxerga (letra de unidade mapeada não existe para o serviço; pasta de rede só por caminho UNC), e o servidor grava e relê um arquivo de teste com nome aleatório e apaga só esse arquivo. Cliente remoto nunca lista pastas nem escolhe caminho no servidor.

**Telas e guardas (F2).** Cada rota decide no `beforeLoad`, a partir de `installation.status` e da sessão, por funções puras testadas (`apps/web/src/lib/installation-gates.ts`):

| Rota | Decisão |
|---|---|
| Shell `_app` (Hoje e destinos) | Estado diferente de `ready` vai a `/configuracao-inicial`; sem sessão vai a `/login?redirect=<caminho pedido>` |
| `/configuracao-inicial` | `ready` vai a `/`; acesso remoto vê só o aviso de concluir no PC; local sem sessão a partir de `account` vai a `/login?redirect=/configuracao-inicial`; senão mostra o passo derivado do estado (`empty` nome, `atelier` conta, `account` códigos, `recovery` pasta, `backup` pasta testada e concluir) |
| `/login` | `empty` e `atelier` vão ao wizard, porque ainda não há dono; com sessão segue ao `redirect` |

- O `redirect` só é seguido quando é caminho interno: começa por `/`, não por `//`, não tem espaço, controle nem barra invertida, e resolve para a mesma origem; senão vira `/`.
- O login automático acontece logo depois do `createOwner`, com as mesmas credenciais; se falhar, a tela vai ao login e volta ao wizard.
- Comando do wizard que recebe `UNAUTHORIZED` descarta a sessão em cache e leva ao login.
- O `opId` se repete enquanto a entrada do passo não muda e é renovado depois do sucesso; "Gerar códigos" usa um `opId` novo a cada clique, porque a repetição devolveria `codes: []`.
- Os códigos aparecem uma vez, com "Baixar arquivo" (texto UTF-8 com BOM), "Copiar" e a confirmação "Guardei os códigos em lugar seguro"; recarregar antes de confirmar exige gerar de novo.
- Falha ao consultar a sessão ou o estado mostra a tela de erro da rota, nunca o login; mensagens de erro do Better Auth nunca aparecem cruas.

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

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
| Monorepo, PWA básica e app Tauri gerados pelo scaffold | Implementado | `apps/web`, `apps/web/src-tauri`, `apps/server`, `packages/*` | F0 |
| Preço sugerido com margem sobre a venda | Implementado como função pura testada | `packages/domain/src/pricing.ts` | F0 |
| Reserva com pendência sem inventar saldo | Implementado como função pura testada | `packages/domain/src/reservation.ts` | F0 |
| SQLite nativo em WAL, validação de caminho local, migrations por Bun | Implementado | `packages/db/src/index.ts`, `packages/db/src/migrate.ts`, `packages/db/tests/native-sqlite.test.ts` | F0 |
| Schema de autenticação | Parcial: tabelas genéricas do Better Auth | `packages/db/src/schema/auth.ts`, migration `0000` | F2 |
| Mesma origem: Hono serve SPA e API só em loopback | Previsto: hoje web em `localhost:3001` e API em `localhost:3000` com CORS | `apps/server/src/index.ts`, `apps/web/src/utils/orpc.ts` | F0 |
| Logs estruturados | Parcial: evlog no servidor, drain em arquivo fora de produção | `apps/server/src/index.ts` | F0 a F7 |
| Dono único, username, rate limit persistido, códigos de recuperação | Previsto: login e cadastro genéricos por e-mail do scaffold | `apps/web/src/routes/login.tsx`, `packages/auth/src/index.ts` | F2 |
| Wizard inicial e sandbox | Previsto | | F2 |
| Dispositivos, epoch, `push`, `pull`, `resolve` | Previsto | | F2 (contrato mínimo), F6 (espelho completo) |
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
| `apps/web` | SPA React com TanStack Router, Vite e PWA; interface compartilhada por desktop e celular |
| `apps/web/src-tauri` | App desktop Tauri v2 para operação e administração local |
| `apps/server` | Hono com oRPC, Better Auth e evlog, executado por Bun |
| `packages/api` | Roteadores oRPC e contexto |
| `packages/auth` | Configuração do Better Auth |
| `packages/db` | Schema Drizzle, migrations e acesso SQLite |
| `packages/domain` | Regras puras de domínio (dinheiro, quantidade, preço, reserva) |
| `packages/ui` | Componentes shadcn/ui e estilos compartilhados |
| `packages/config` | `tsconfig` base |

A UI usa caminhos relativos (`/rpc`, `/api`) em todas as origens. Em produção, o Hono serve SPA, assets e API num único processo ligado apenas a `127.0.0.1`; o Tauri aponta para esse loopback e o `cloudflared` encaminha o subdomínio público ao mesmo endereço. Nenhuma porta HTTP é exposta na LAN ([ADR 0001](adr/0001-origem-canonica-e-local-first.md)).

SQLite em WAL é a fonte autoritativa única, aberta por Drizzle sobre `bun:sqlite`, e um processo servidor controla gravações e transações ([ADR 0006](adr/0006-sqlite-nativo-bun.md)). Banco e mídia ficam fora do diretório de instalação: `%PROGRAMDATA%\CosturaPro\data` no Windows e `/var/lib/costura-pro` no Linux. Configuração e segredos usam permissões do sistema operacional. O instalador configura o servidor como serviço ativo no boot, o Tauri para operação e administração e o `cloudflared` como serviço opcional após receber o token ([ADR 0007](adr/0007-servico-do-so-e-tauri-administrativo.md)). Sem internet, o desktop chama o loopback; a PWA já carregada opera pelo service worker e IndexedDB e não sincroniza até o Tunnel voltar.

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

**Estado:** previsto (contrato mínimo na F2, espelho completo na F6).

oRPC expõe recursos autenticados de consulta e comando para cada agregado e os endpoints de sync. Interfaces mínimas:

```ts
type Money = string; // centavos inteiros
type Quantity = string; // milionésimos da unidade base
type Operation = {
  opId: string;
  deviceId: string;
  epoch: string;
  aggregateType: string;
  aggregateId: string;
  baseVersion: number | null;
  occurredAt: string;
  command: string;
  payload: unknown;
  mediaHashes?: string[];
};
type PushResult = {
  accepted: { opId: string; newVersion: number }[];
  conflicts: { opId: string; currentVersion: number; current: unknown }[];
  quarantined: { opId: string; reason: string }[];
  exceptions: { opId: string; kind: string; referenceId: string }[];
  cursor: string;
  epoch: string;
};
type PullResult = {
  changes: unknown[];
  cursor: string;
  epoch: string;
  serverVersion: string;
};
```

`/api/sync/push` aplica cada operação em transação curta, verificando autenticação, aprovação do dispositivo, epoch, `opId` único e versão-base. `opId` já aplicado devolve o mesmo resultado; retry de mídia usa hash de conteúdo. Mudanças independentes não param por causa de um conflito. Comandos de fato (venda, pagamento, consumo) aceitam concorrência e criam exceção de saldo quando necessário; edições de campos sobre versão-base diferente viram conflito com valores lado a lado, nunca última gravação vence às cegas.

`/api/sync/pull` entrega mudanças por cursor até espelhar clientes, catálogo, estoque, OS, OP, vendas, finanças e documentos necessários. `/api/sync/resolve` registra escolha, mescla ou desfazer com motivo auditado.

Dispositivo isolado por qualquer tempo faz rebase do snapshot completo sem apagar a outbox. Atualização do cliente migra Dexie e outbox antes do sync; operações incompatíveis vão para quarentena. Restauração incrementa o epoch e toda operação antiga é retida para reaplicação manual, nunca mesclada automaticamente ([ADR 0004](adr/0004-backup-epoch-e-cofre-por-dispositivo.md)).

**Mídia.** Upload autenticado por hash SHA-256, MIME permitido e limite configurado; referência de banco e gravação de arquivo são finalizadas com verificação de hash. O original é convertido e limitado na captura (JPEG ou WebP conforme suporte, dimensão máxima inicial de 2048 px, qualidade inicial 0,82) e ganha miniatura. Todas as miniaturas do espelho ficam offline; imagem grande já vista pode ser cacheada.

**PDF.** Fontes e templates versionados empacotados com a PWA; a emissão gera bytes finais, SHA-256, dados congelados e documento com versão. O servidor nunca regenera documento antigo com template novo ([ADR 0008](adr/0008-documentos-emitidos-imutaveis.md)).

## 5. Segurança e armazenamento local

**Estado:** previsto (F2 e F6).

**Conta.** Better Auth mantém uma única conta de dono com o plugin `username` para login por usuário e senha. O e-mail técnico exigido pela base de e-mail e senha é local (`owner@costura-pro.local`) e não é canal de recuperação. Cadastro público fica desativado após o onboarding, garantido no servidor e não só na interface. Sessão server-side usa cookie `HttpOnly`, `Secure` no Tunnel, `SameSite` adequado à mesma origem, proteção CSRF e lista explícita de origens; em desenvolvimento local por HTTP o cookie não pode exigir `Secure`. Rate limit persistido no SQLite por usuário e IP (regra inicial: 5 tentativas por 60 segundos em `/sign-in/username`), atraso progressivo e bloqueio temporário; tentativas são logadas sem senha. [Better Auth: plugin Username](https://better-auth.com/docs/plugins/username), [Better Auth: rate limit](https://better-auth.com/docs/concepts/rate-limit).

**Dispositivos e recuperação.** Um desktop autenticado como administrador local aprova ou revoga dispositivos, diretamente ou emitindo um código de ativação de uso único; um celular novo só obtém espelho sensível após aprovação. Códigos de recuperação são gerados aleatoriamente, apresentados uma vez e guardados só como hash; o consumo invalida o código. O resgate físico extremo exige administrador do sistema operacional no PC, redefine só a conta, emite novos códigos de recuperação e cria evento de auditoria. O token do Tunnel é segredo de instalação com permissões do sistema operacional, fora do banco exportado, do backup e dos logs.

**Cofre.** No primeiro espelho, cada dispositivo cria sal e senha forte de cofre. WebCrypto deriva a chave por PBKDF2-HMAC-SHA-256 com parâmetro calibrado e versionado por plataforma e cifra registros e arquivos com AES-256-GCM, nonce novo por objeto e AAD com dispositivo, epoch, tipo e id. A senha não é enviada ao servidor nem recuperada por códigos da conta. O PIN bloqueia apenas a interface durante inatividade em primeiro plano; quando o app vai para segundo plano ou fecha, a chave é descartada da memória e a senha do cofre é exigida na volta. A outbox exportada inclui manifesto, identidade do dispositivo, epoch, `opId`s, hashes, sal e parâmetros e bytes cifrados; pode ser importada numa nova instalação com a senha, após validação de integridade, mantendo idempotência. Senha esquecida exige apagar o cofre local e reconstruir o espelho; outbox não exportada e perdida não é recuperável.

**PWA.** `display: standalone`, service worker com app shell, assets, fontes e templates offline, Dexie para espelho e outbox cifrados, tratamento de quota e eviction, pedido de `navigator.storage.persist()` e exportação manual. No iOS, abrir no Safari ou instalar um segundo ícone cria outra instância e outra identidade. A interface mostra conexão, último sync, operações pendentes, falhas e exceções. A sessão offline do app não vence, mas a sessão remota do Better Auth pode exigir login ao reconectar sem apagar a fila. Revogação remota só produz efeito no próximo contato.

## 6. Documentos, backup, restauração e atualização

**Estado:** previsto (F4 e F7).

**Documentos.** PDFs não fiscais em A4 e 80 mm, com logo, nome, contato, endereço, código, data, itens visíveis, descontos, totais e pagamentos conforme o tipo. Dados de emissão, bytes, template, fontes e hash são imutáveis; revisão ou estorno referencia a emissão anterior. PDF final e fotos emitidos offline entram no cofre e no sync. Impressão pelo diálogo padrão do navegador ou do Tauri. Compartilhar é ação explícita do dono; o atalho de WhatsApp não envia automaticamente.

**Backup.** Agendado às 02:00, usa transação ou barreira curta para fixar o manifesto de mídia e um snapshot SQLite consistente. `bun:sqlite` executa `VACUUM INTO` para cópia consistente; a API `node:sqlite` do Bun está marcada como não implementada e não deve ser usada. Copiar exatamente os arquivos referenciados pelo snapshot, montar pacote temporário com manifesto de versão, schema, tamanhos e SHA-256 de cada arquivo, validar `PRAGMA integrity_check` e só então promover o arquivo final na pasta escolhida. No boot, executar backup compensatório se o último dia local não tem cópia. Reter as 7 últimas cópias diárias válidas; no início de cada mês, preservar a última diária válida do mês anterior como mensal, mantendo as 12 últimas mensais. Aplicar retenção só depois de nova cópia validada; na falta de espaço ou falha, nunca remover cópia para abrir espaço. Fotos originais otimizadas, miniaturas, PDFs e configuração não secreta entram no pacote; Tunnel e cofres não. O pacote não é cifrado. [SQLite: backup e VACUUM INTO](https://www.sqlite.org/backup.html), [Bun: SQLite](https://bun.com/docs/runtime/sqlite), [Bun: `node:sqlite`](https://bun.com/reference/node/sqlite).

**Restauração.** Só no desktop e na administração local: validar pacote, hash, schema e versão antes de substituir, pedir código de recuperação, pausar escritas e sync, fazer pré-backup do estado atual, trocar dados e arquivos de forma atômica ou por staging verificável, incrementar o epoch, testar integridade e saúde e manter o pré-backup recuperável. Falha nunca promove estado parcial. Outboxes antigas vão para quarentena.

**Atualização** ([ADR 0005](adr/0005-atualizacao-coordenada.md)). Mesmo princípio: janela ociosa após backup, bloquear novas escritas, pré-backup, staging de binários assinados, migração, checagem de saúde de API, banco, mídia e Tauri e promoção; falha reverte binários, banco e mídia e reabre escritas. Operações aceitas durante a janela nunca são descartadas. O updater do Tauri verifica a própria assinatura, mas um supervisor de instalação coordena servidor e serviços. Releases públicos do GitHub fornecem manifesto e artefatos Windows x64 e Linux x64 assinados; a chave privada nunca fica no repositório. O `cloudflared` é atualizado separadamente com checagem de conectividade, sem modificar o token.

## 7. Empacotamento, observabilidade e testes

**Estado:** observabilidade parcial; empacotamento previsto (F7); testes de domínio e banco já existem.

**Windows.** MSI ou NSIS do Tauri por máquina e servidor Bun compilado para Windows x64, serviço com início automático, dados em ProgramData, desinstalação preservando dados e backups salvo pedido explícito. Sem certificado comercial inicial pode haver SmartScreen; assinatura de atualização é obrigatória. O identificador do app Tauri (`com.tauri.dev` no scaffold) precisa ser definitivo antes do primeiro instalador.

**Linux.** Pacote `.deb` para Ubuntu 24.04 LTS x64 com `systemd`, AppImage opcional do Tauri, dados em `/var/lib/costura-pro`; privilégios são pedidos pelo instalador, nunca pelo app diário. O Bun gera binário standalone para Windows e Linux, mas o banco vivo fica sempre fora dele. [Bun: executáveis](https://bun.com/docs/bundler/executables), [Tauri: updater](https://v2.tauri.app/plugin/updater/).

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

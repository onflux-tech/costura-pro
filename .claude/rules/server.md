---
paths:
  - "apps/server/**"
  - "packages/api/**"
  - "packages/auth/**"
---

# Servidor, API e autenticação

- Contratos: [mesma origem](../../docs/SPEC.md#1-topologia-e-componentes), [sync](../../docs/SPEC.md#4-api-sincronização-e-conflito) e [conta e bootstrap](../../docs/SPEC.md#5-segurança-e-armazenamento-local).
- Valor monetário e quantidade saem no JSON como string decimal.
- Logs com evlog sem senha, token, medidas, fotos ou dados completos de cliente (RNF-08).
- Teste de integração com Hono autenticado e SQLite real; banco em memória não vale como evidência.
- Rotas de administração (backup, restauração, Tunnel, atualização, dispositivos e navegador de pastas) só pelo acesso local: Host de loopback, sem `cf-connecting-ip` e com sessão do dono ([ADR 0011](../../docs/adr/0011-servico-do-so-e-acesso-local-no-navegador.md)).
- Skills: `better-auth-best-practices`, `better-auth-security-best-practices`, `analyze-logs` e `build-audit-logs`.

## Armadilhas conhecidas

- Cookie `Secure` vindo de HTTP some no WebKit: o Better Auth roda com `useSecureCookies: false` e o `Secure` entra por Host canônico em `apps/server/src/origin.ts`; nunca volte a `defaultCookieAttributes` com `secure` ou `sameSite: "none"`.
- Middleware do Hono que mexe em `Set-Cookie` edita `c.res.headers` no lugar; atribuir `c.res` recopia os cookies antigos.
- O export do servidor mantém `hostname: "127.0.0.1"` e `port: env.PORT` explícitos: sem eles o Bun escuta em todas as interfaces e ignora a `PORT` do varlock.
- `serveStatic` usa `root` absoluto com `path` relativo; `path` absoluto sem `root` quebra só no Linux.
- Rota nova fora de `/api`, `/api-reference` e `/rpc` cai no fallback da SPA: prefixo novo de servidor entra na regex de `apps/server/src/web.ts` e na denylist do service worker.
- O rate limit de `/sign-in/username` (5 por 60 s) conta sucesso e falha, e toda requisição local cai num único balde sem IP: verificação manual ou teste de produção com mais de 5 logins locais seguidos recebe 429. O aviso "Rate limiting could not determine a client IP" no boot de produção é esperado para o acesso local.
- Com `NODE_ENV=test` o Better Auth desliga sozinho a checagem de Origin e CSRF: teste de `trustedOrigins` ou de CSRF roda contra o processo de produção (`apps/server/tests/production.test.ts`).
- `bun test` direto em `apps/server` usa o `dist` que existir; o `pnpm test` pelo turbo constrói servidor e web antes.
- Cadastro público fechado só na interface não basta: o dono nasce só por `installation.createOwner` local, e rota nova do Better Auth entra na allowlist de `apps/server/src/auth-routes.ts` apenas com teste em `apps/server/tests/access.test.ts`. `disabledPaths` do Better Auth vale só no HTTP; `auth.api.*` no servidor ignora.
- Em teste e desenvolvimento o Better Auth usa `127.0.0.1` como IP quando falta cabeçalho confiável; em produção cai no balde `no-trusted-ip`. Teste que depende de IP distinto manda `cf-connecting-ip` (acesso remoto).
- Várias chamadas oRPC disparadas num array e aguardadas uma a uma deixam rejeição sem handler; teste sequencial usa funções e o `inSequence` de `apps/server/tests/support.ts`, que também evita `noAwaitInLoops`.
- Resultado gravado em `operation` é devolvido em toda repetição do `opId`: anule senha, código e segredo com o objeto `redact` (por exemplo `{ code: null }`) e tire-os do hash do conteúdo. `redact` como função faria o TypeScript fixar o resultado como `unknown`.
- Comando direto em `runDirectCommand` devolve `record(tx, resultado)` de dentro da transação que aplica o efeito; o tipo recusa handler que não grava. Gravar o `opId` numa transação separada deixa a repetição executar o efeito de novo.
- Trava em processo por chave (como a fila por `opId` de `packages/api/src/operations.ts`) consulta e registra a promessa sem `await` no meio; um `await` entre os dois deixa duas chamadas simultâneas passarem.
- O adapter do Drizzle no Better Auth roda com `transaction: false`: `signUpEmail` que falha no meio deixa usuário sem conta `credential`, e o hook de usuário único passa a recusar o próximo cadastro. Limpe órfãos na falha e reconcilie no boot (`packages/api/src/installation/store.ts`).
- Código curto guardado por hash (40 bits ou menos) usa HMAC com o segredo do Better Auth; SHA-256 puro de código curto se inverte por força bruta a partir de um backup.
- A causa de um erro de validação do oRPC carrega o valor recebido (senha, código): log de erro de procedure passa por `logProcedureError` em `apps/server/src/app.ts`, que registra só código, status, mensagem e código e caminho dos problemas, nunca o objeto do erro inteiro.
- O Biome não conhece o global `Bun`: teste usa `node:crypto`, `node:util` e `node:timers/promises` no lugar de `Bun.CryptoHasher`, `Bun.inspect` e `Bun.sleep`.
- O `cloudflared` conecta pelo loopback: acesso local se decide pelo Host de loopback sem `cf-connecting-ip`, nunca pelo IP do socket.
- Serviço do Windows não enxerga letra de unidade mapeada da sessão do usuário: navegador de pastas e backup aceitam caminho local ou UNC e sempre testam gravação e releitura.
- Teste com muitos logins reais (hash de senha) passa perto dos 5 s padrão do `bun test` num runner lento: dê limite próprio no terceiro argumento do `test`, porque o estouro fecha o banco com requisições em curso e aparece como "Cannot use a closed database".
- Comando de agregado é definido uma vez no registro (`packages/api/src/<area>/commands.ts`) e exposto pela procedure direta com `runCreateCommand` ou `runUpdateCommand`, que gravam `aggregate_type` e `aggregate_id` na `operation`. Operação direta sem agregado fica fora da redação ([agregados](../../docs/areas/agregados.md)).
- `syncCommands` é declarado com `satisfies`, não com anotação de tipo: é isso que deixa `CreateCommandName` e `UpdateCommandName` literais e recusa, na compilação, procedure que chama criação como edição.
- Dado pessoal não fica só na linha viva: snapshot do `change_log`, valores e motivo de `sync_conflict`, `current` de resultado de conflito e o `op_hash` guardam cópias. Hash de patch curto (só telefone) com o resto da operação na mesma linha se inverte por força bruta. Toda operação nova que toca agregado com dado pessoal precisa ser alcançável por `redactHistory` (`packages/api/src/redaction.ts`), inclusive as que chegam depois da anonimização pelo push.
- Mensagem de erro que a web compara mora em `packages/api/src/command-messages.ts`; literal copiado na web ou no teste da web deixa o ramo da tela morrer em silêncio quando o servidor muda o texto.
- Criação pelo push confere que o id é UUID (ADR 0009): as procedures diretas e as rotas da web exigem UUID, e um id livre criava registro que ninguém consegue abrir nem anonimizar.
- Quarentena de comando de agregado com dado pessoal (`personalDataAggregates` em `packages/api/src/redaction.ts`) grava `op_hash` `redacted` por qualquer motivo e por qualquer caminho do push, inclusive `invalidEnvelope`, procurando o comando pelo nome (`commandNamed`): operação que nunca virou linha (edição de medição criada depois da anonimização) não é alcançada pela redação, e medida curta se inverte por força bruta. Agregado novo com dado pessoal entra nesse conjunto.
- Schema de patch é validado de novo no `keepLocal` sobre o payload já normalizado: texto opcional usa `optionalText` (aceita `null`), senão limpar uma nota vira conflito impossível de resolver.
- Edição de agregado usa `updateCommands` (`packages/api/src/update-command.ts`); regra que dependeria do banco para validar payload (campo que não pode sumir) se desenha na forma (payload só com ativos e merge que desativa ausentes), porque `apply` não tem caminho de rejeição no push.
- `createApp` semeia os modelos de medidas no boot: banco sem a migration `0005` derruba o servidor com `no such table: measurement_template`. Atualizar um banco existente exige `pnpm --filter @costura-pro/db run db:migrate` antes de subir.
- Rota Hono fora do oRPC (como `/api/media`) não passa pelo `logProcedureError`: exceção sem `try`/`catch` cai no `errorHandler` padrão do Hono, que imprime o erro inteiro, com caminho de arquivo e hash. Trate a falha na rota e registre só o `code` ([mídia](../../docs/areas/midia.md)).
- URL que carrega dado sensível (hash de foto) fica fora do evento amplo do evlog pelo `exclude`; o teste de drain precisa de controle positivo (uma rota que aparece) e de espera pelo drain, senão passa com o drain vazio.
- Agregado que guarda hash de foto entra no conjunto `referencedHashes` de `packages/api/src/media/store.ts` e na anonimização; fora dele a coleta apaga a foto confirmada.
- Rotina periódica sobre todas as linhas (coleta de mídia) calcula o que precisa numa consulta só e cede a vez com `setImmediate` entre itens; consulta por item vira custo quadrático e segura o servidor. Teste de volume com limite de tempo acompanha.
- Arquivo final de mídia nunca recebe `rename` por cima (no Windows falha com `EPERM` enquanto alguém lê); `rename` e `unlink` repetem em `EPERM`, `EACCES` e `EBUSY` (`retrying` em `packages/api/src/media/files.ts`).
- `apps/server` importa `@costura-pro/domain` como dependência `workspace:*` com referência no `tsconfig.json`; sem as duas, o import compila no editor e quebra no `check-types`.
- Teste de ordem total com relógio real passa por acaso: registros criados no mesmo milissegundo empatam em `created_at`. Use `manualClock` de `apps/server/tests/support.ts` para provar o desempate.
- Schema de payload com dinheiro ou quantidade devolve string canônica de dígitos (`moneyCentsSchema`, `quantityMicrosSchema`), nunca `bigint`: o `sync_conflict` grava o payload já parseado como JSON, e `JSON.stringify` de `bigint` lança e derruba o `sync.push` inteiro. A conversão para `bigint` fica no store, e o snapshot converte de volta ([ADR 0017](../../docs/adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md)).
- Checagem de faixa no mesmo schema roda junto com o `regex`, não depois: `z.string().regex(...).refine(v => BigInt(v) <= teto)` executa o `refine` mesmo com o `regex` reprovado e estoura `SyntaxError` num valor como `"12,50"`. Valide a forma dentro do próprio `refine` ou encadeie com `pipe`.
- Campo que o patch não aceita (unidade base da variante) é removido pelo zod em silêncio: patch só com ele cai em "Nada para alterar" (`invalidPayload` no push), e patch misto ignora o campo. Prove o caminho no teste de sync.

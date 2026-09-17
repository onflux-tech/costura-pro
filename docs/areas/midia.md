# Mídia

**Files:** `packages/domain/src/media.ts`, `packages/db/src/schema/media.ts`, `packages/api/src/media/files.ts`, `packages/api/src/media/lock.ts`, `packages/api/src/media/store.ts`, `packages/api/src/media/collect.ts`, `packages/api/src/clients/anonymize.ts`, `apps/server/src/media.ts`, `apps/server/src/app.ts`, `apps/server/src/index.ts`, `apps/web/src/lib/photo-capture.ts`, `apps/web/src/lib/photo-capture-error.ts`, `apps/web/src/atendimento/use-photo-drafts.ts`, `apps/web/src/atendimento/photo-field.tsx`, `apps/web/src/atendimento/photo-viewer.tsx`, `packages/ui/src/components/photo.tsx`, `packages/ui/src/components/photo-tile.tsx`, `packages/ui/src/components/file-picker-button.tsx`, `apps/server/tests/media.test.ts`, `apps/server/tests/media-collect.test.ts`, `apps/server/tests/received-items-anonymization.test.ts`

## Overview

Fotos são arquivos imutáveis identificados pelo SHA-256 do próprio conteúdo ([ADR 0016](../adr/0016-midia-enderecada-por-conteudo.md)). O aparelho otimiza cada foto, calcula o hash e envia os bytes por uma rota Hono própria; o servidor grava o arquivo de forma atômica e registra a linha de `media_file`. O registro de negócio que usa a foto (a [peça recebida](agregados.md)) guarda só os hashes, pelos comandos de agregado de sempre, e o comando não confere se o arquivo existe. A primeira usuária foi a peça recebida, com até 12 fotos; a variante de material veio depois, com uma foto ([catálogo de materiais](catalogo.md)). Fotos de perfil e a galeria do produto reaproveitam a mesma infraestrutura.

## Caminho de uma foto

```mermaid
sequenceDiagram
  participant A as Aparelho
  participant S as PUT /api/media/hash
  participant D as Disco e media_file
  participant C as Comando da peça
  A->>A: createImageBitmap, 2048 e 512 px, WebP ou JPEG, SHA-256
  A->>S: bytes da foto e da miniatura
  S->>S: sessão, ready, tamanho, tipo pelos bytes, hash
  S->>D: temporário, fsync, rename; depois a linha
  A->>C: receivedItems.create ou update com os hashes
  A->>S: GET /api/media/hash (miniatura na grade, original no visualizador)
```

## Parâmetros

| Item | Valor | Onde |
|---|---|---|
| Formato | WebP onde o navegador gera; JPEG onde o `toBlob` devolve outro tipo (Safari) | `apps/web/src/lib/photo-capture.ts` |
| Original | 2048 px no lado maior, qualidade 0,82 | `mediaLimits` em `packages/domain/src/media.ts` |
| Miniatura | 512 px, qualidade 0,80, mesmo formato do original | `mediaLimits` |
| Limite por arquivo | 4 MiB, contado em streaming no servidor | `mediaLimits.maxBytes` |
| Tipos aceitos | JPEG (`FF D8 FF`) e WebP (`RIFF....WEBPVP8` com tamanho do RIFF conferido) | `detectMediaType` |
| Seletor de arquivo | `accept="image/jpeg,image/png,image/webp"`; "Câmera" com `capture="environment"` e "Galeria" com `multiple` no toque, "Escolher fotos" no PC | `apps/web/src/lib/received-items.ts`, `photo-field.tsx` |
| Pasta | `media/ab/cd/<hash>.webp` (ou `.jpg`) e `media/tmp`, dentro da pasta do `DATABASE_FILE` | `apps/server/src/index.ts`, `packages/api/src/media/files.ts` |

## Rotas

| Rota | Respostas |
|---|---|
| `PUT /api/media/:hash` | 401 sem sessão, 412 antes de `ready`, 400 hash inválido, 413 acima de 4 MiB, 415 tipo não aceito, 422 hash diferente, 200 linha e arquivo já presentes (renova `uploaded_at`), 201 gravado, 500 falha de gravação sem linha nova |
| `GET /api/media/:hash` | 401, 412, 404 sem linha ou sem arquivo (conferido antes do 304), 304 por `If-None-Match`, 500 de leitura registrando só o código do erro, 200 com `Cache-Control: private, max-age=31536000, immutable`, `ETag`, `nosniff` e `Content-Disposition` (`attachment` com `?download=1`) |

As duas rotas aceitam qualquer acesso com sessão do dono (o celular chega pelo Tunnel), passam pelo `originGuard` global e ficam fora do evlog (`exclude: ["/api/media/**"]`), porque a URL carrega o hash. Erro de arquivo é registrado só pelo código.

## Gravação, coleta e anonimização

| Momento | O que acontece |
|---|---|
| Upload | Dentro de `withMediaLock(hash)`: se a linha existe e o arquivo tem o tamanho dela, 200 sem regravar; senão `writeMediaFile` (temporário, `sync`, `rename`, nunca `rename` sobre final existente; final igual fica intacto, final corrompido é apagado antes) e só então `upsertMediaFile` |
| Referência | Um hash está referenciado quando aparece em `received_item.photos`, em `material_variant.photo` ou nos valores locais e atuais de um conflito aberto desses dois tipos; agregado novo com foto acrescenta seus caminhos JSON ao `referencedHashes` |
| Coleta | `collectMedia` no boot e a cada 1 h, sem sobrepor execuções (`startMediaCollection`): as candidatas saem de uma consulta só (`listUnreferencedMediaFilesUploadedBefore`, com o conjunto `referencedHashes` montado uma vez por `json_each` sobre `received_item` e os valores locais e atuais dos conflitos abertos de `receivedItem`); cada candidata é conferida de novo por `isMediaReferenced` numa transação dentro da trava, com `setImmediate` entre elas para não segurar o servidor, e sai a linha na transação e o arquivo depois; arquivo sem linha com mais de 24 h (removido pelo caminho em que foi achado) e temporário com mais de 1 h saem |
| Anonimização | Junta os hashes da linha viva, do `change_log` e de todos os conflitos de cada peça do cliente, redige as peças, apaga as linhas de `media_file` sem outra referência na mesma transação (antes do `truncateWal`) e remove os arquivos depois do commit; falha de remoção não muda a resposta e fica para a coleta |

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| WebP pedido vira PNG gigante no iPhone | Safari não codifica WebP no canvas e devolve PNG, como manda a spec | Conferir `blob.type` e cair para JPEG |
| Foto HEIC não abre no PC | Chrome e Edge não decodificam HEIC | `accept` sem `image/heic` (o iPhone converte para JPEG) e mensagem de decodificação |
| Hash da foto aparece no log | O evento amplo do evlog grava o caminho da requisição | `exclude` do evlog para `/api/media/**`, com teste de drain |
| Hash do cliente anonimizado nos bytes do `.db` | Linha apagada depois do checkpoint do WAL fica na página antiga do arquivo | Apagar as linhas de `media_file` na transação da anonimização |
| Foto confirmada some | Coleta sem olhar conflitos abertos (valores locais e atuais), sem a miniatura ou reenvio sem renovar a carência | `referencedHashes` com foto, miniatura e os dois lados dos conflitos abertos, e `uploaded_at` renovado no 200; teste com miniatura de hash diferente da foto |
| Coleta leva segundos e segura o servidor com milhares de fotos | Conjunto de referências recalculado por candidata (quadrático); `NOT EXISTS` correlacionado com `json_each` continuou lento | Conjunto único em `UNION` com `NOT IN` filtrando `NULL` (um `NULL` no conjunto faz o `NOT IN` não devolver nada) e teste com 2000 fotos referenciadas abaixo de 1 s |
| Arquivo fora da subpasta certa nunca sai da pasta | A coleta achava o arquivo na varredura e apagava pelo caminho recalculado do hash | `removeFileAt(file.path)` com o caminho achado; o teste de produção põe um órfão velho fora do lugar |
| Hash da foto no log quando a leitura falha | Exceção fora do oRPC cai no `errorHandler` padrão do Hono, que imprime o erro com o caminho do arquivo | `try`/`catch` nas duas rotas com `console.error` só do `code`, e teste de falha de leitura e de gravação que confere o log |
| Verificação de 404 depois de anonimizar mostra a foto | Cache HTTP `private, immutable` do próprio navegador | `fetch(url, { cache: "no-store" })` na verificação |
| Coleta de teste não remove nada ou remove tudo | `mtime` real contra relógio manual | Idades de arquivo por `utimes` relativas ao `now` passado a `collectMedia` |

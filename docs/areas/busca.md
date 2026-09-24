# Busca global

**Files:** `packages/domain/src/search.ts`, `packages/domain/src/search.test.ts`, `packages/api/src/search.ts`, `packages/api/src/global-search/queries.ts`, `packages/api/src/global-search/router.ts`, `packages/api/src/clients/queries.ts`, `packages/api/src/materials/queries.ts`, `packages/api/src/products/queries.ts`, `packages/api/src/services/queries.ts`, `packages/api/src/quotes/queries.ts`, `packages/api/src/service-orders/queries.ts`, `packages/ui/src/components/command-palette.tsx`, `packages/ui/src/components/tabs.tsx`, `packages/ui/src/components/highlight.tsx`, `packages/ui/src/components/top-nav.tsx`, `packages/ui/src/components/mobile-header.tsx`, `apps/web/src/lib/search.ts`, `apps/web/src/search/`, `apps/web/src/routes/_app/busca.tsx`, `apps/web/src/shell/app-shell.tsx`, `apps/server/tests/global-search.test.ts`, `apps/web/tests/search.test.ts`

## Overview

A busca global acha pelo texto o que o dono já cadastrou: clientes, perfis de usuário da peça, orçamentos, OS, produtos, materiais e serviços ([CONTEXT](../../CONTEXT.md), [DEC-129 a DEC-134](../PRD.md#91-produto-e-escopo), [DEC-146 e DEC-162](../PRD.md#94-comercial-e-documentos)). Ela tem duas camadas:

- o **diálogo de busca rápida**, sobre a tela atual, aberto pelo botão do cabeçalho verde e por Ctrl+K (Cmd+K), com até 3 resultados por grupo e "Ver todos os N resultados" no fim;
- a **página `/busca`**, dentro do shell, com uma aba por grupo e a lista completa, aberta pelo "Ver todos" do diálogo e pela lupa do cabeçalho do celular.

São duas leituras, sem comando e sem nada no sync: `search.global` monta os sete grupos numa requisição, com a primeira página e o total de cada um, e `search.group` pagina um grupo de 50 em 50 ([SPEC §4](../SPEC.md#4-api-sincronização-e-conflito)). A busca offline sobre o espelho local chega na F6.

A regra das palavras é a mesma das listas de cada área: cada palavra da busca precisa aparecer como trecho em algum campo do registro, sem acento e sem maiúsculas, com trecho de telefone pelos dígitos. Para isso não divergir, o filtro de cada área é uma função só, chamada pela lista e pela busca, e as funções puras de texto moram no domínio.

## Onde a regra mora

| Peça | Onde | O que faz |
|---|---|---|
| Normalização e palavras | `normalizeText` e `searchTokens` em `packages/domain/src/search.ts` | Tiram acento, maiúscula e espaço repetido; trecho só de dígitos e `()-+.` vira só dígitos. Os stores gravam o `search_text` com a mesma normalização |
| Casamento em memória | `matchesAll` | Toda palavra como trecho do texto normalizado; é o equivalente do `LIKE %palavra%` sobre o `search_text`, usado nos perfis, que não têm `search_text`, e na busca offline |
| Variante destacada | `matchedVariants` | Normaliza o pai e cada variante; decidem só as palavras que o pai não contém, e entra a variante que tem pelo menos uma delas, pelo número que tem e, no empate, na ordem da página |
| Trecho marcado | `highlightRanges` | Intervalos do texto original onde cada palavra casa, achados no texto normalizado caractere a caractere e convertidos de volta (acento decomposto inclusive), ordenados e fundidos quando se sobrepõem ou se encostam |
| Limites | `searchLimits` | 2 a 100 caracteres; 3 por grupo no diálogo, 5 por grupo em "Tudo", 50 por página na aba e 3 variantes por linha |
| Filtro de cada área | `clientMatches`, `quoteMatches`, `serviceOrderMatches`, `materialMatches`, `productMatches`, `serviceMatches` nas consultas de cada área | O mesmo `LIKE` com `containing` (`%` e `_` escapados) que a lista usa; produto e material também casam por uma variante, arquivada inclusive |
| Leituras | `globalSearch` e `groupSearch` em `packages/api/src/global-search/queries.ts` | Uma fonte por grupo com a página e a contagem sobre o mesmo filtro; ativos primeiro e o resto na ordem da lista |
| Tela | `apps/web/src/lib/search.ts` e `apps/web/src/search/` | Grupos do diálogo, abas, textos de cada linha, status para leitor de tela, estados vazios e o atalho |

## Grupos

| Grupo | Casa por | A linha mostra | Abre |
|---|---|---|---|
| Clientes | nome, e-mail e telefones | telefone formatado, senão o secundário, senão e-mail, senão "Sem contato"; selos organização e arquivado | ficha do cliente |
| Perfis | nome do perfil | "Perfil de" e o cliente; selo arquivado | ficha do cliente com o perfil escolhido (`?perfil=`) |
| Orçamentos | código, dígitos do código, títulos das linhas e nome do cliente | código marcado; cliente, estado do dia (rascunho, emitido, aprovado, vencido ou recusado) e total ao cliente; selo arquivado | página do orçamento |
| OS | código, dígitos do código, títulos dos subitens e nome do cliente | código marcado; cliente, subitens, prazo ("a combinar" sem prazo) e total a receber ou "sem cobrança" (`serviceOrderDetail`); a OS não tem arquivamento | página da OS |
| Produtos | nome, categoria, nome ou código de variante | categoria e variantes ativas; até 3 variantes com código e preço praticado, e "e mais N" (no diálogo, a primeira) | página do produto |
| Materiais | nome, categoria, nome ou código de variante | categoria e variantes ativas; até 3 variantes com código e saldo total na unidade base (no diálogo, a primeira) | página do material |
| Serviços | nome e categoria | categoria e preço praticado; selo terceirizado | página do serviço |

Nenhum grupo traz custo, custo de referência, valor de estoque ou margem: preço praticado, total ao cliente e saldo em quantidade sim. O estado do orçamento é calculado na tela (`quoteDetail`), com o dia de hoje, a partir da aprovação, da recusa e do "válido até" da última revisão que a leitura traz. O rótulo do atalho da aba concorda com o grupo ("Ver as 3 OS", "Ver os 6 clientes"). O trecho casado aparece marcado no nome e nas variantes (`Highlight` com `highlightRanges`).

## Diálogo

O `SearchDialog` (`apps/web/src/search/search-dialog.tsx`) mora no shell e usa o `CommandPalette` do design system. Abre pelo `TopNavSearch` e por Ctrl+K fora de `/busca` (`useSearchShortcut`), por cima de qualquer tela: o formulário aberto embaixo não perde nada, e Esc devolve o foco a quem o tinha. O atalho é ignorado com o foco dentro de outro diálogo.

- O campo espera 250 ms depois da última tecla e só lê com 2 caracteres ou mais; abaixo disso mostra a dica.
- Cada grupo mostra até 3 resultados, com o total no rótulo ("Clientes · 6"); o primeiro fica em destaque, as setas movem o destaque e Enter ou toque abre o registro e fecha o diálogo.
- O último item é "Ver todos os N resultados", que abre `/busca?busca=…`; sem resultado, é "Buscar também nos arquivados", que abre a página com a caixa marcada.
- Resultado em andamento fica esmaecido, com `aria-busy`, e o status anuncia "Buscando …"; "Nada encontrado" só aparece com a resposta.
- Na falha sem resultado, "Não foi possível buscar." com "Tentar de novo", que devolve o foco ao campo.
- O texto zera ao fechar.

## Página

A página `/busca` guarda a busca, a caixa de arquivados e a aba na URL (`busca`, `arquivados=1`, `grupo`), então voltar de um resultado e recarregar devolvem tudo como estava.

- **Abas.** "Tudo" e uma aba por grupo com resultado, cada uma com a contagem. `grupo` desconhecido, ou de um grupo sem resultado para a busca atual, cai em "Tudo". As setas movem o foco entre as abas, e Enter ativa.
- **Tudo.** Os grupos com 5 resultados cada, e "Ver os N <grupo>" quando o grupo tem mais, que troca de aba e leva o foco ao painel da aba nova.
- **Aba de grupo.** O grupo inteiro por `search.group`, 50 por vez com "Mostrar mais"; só o painel ativo fica montado, então só ele lê.
- **Campo.** Vai para a URL 300 ms depois da última tecla; recebe o foco quando a página abre sem busca e, voltando com uma busca, o foco não é roubado. Na página, Ctrl+K foca e seleciona o campo. Quando a busca muda por fora (o "Ver todos" do diálogo aberto na própria página, voltar), o campo acompanha a URL.
- **Estados.** Dica abaixo de 2 caracteres, esqueleto na primeira leitura, "Nada encontrado para …" com a dica de incluir arquivados, resultado em andamento esmaecido com `aria-busy` e status "Buscando …". Na falha sem resultado, o alerta aparece abaixo do campo com "Tentar de novo", que devolve o foco ao campo sem selecionar; falha ao carregar mais mostra o alerta, e o próprio "Mostrar mais" tenta de novo.
- **Lupa.** A lupa do cabeçalho do celular abre a página; em `/busca`, ela mantém a busca e a caixa.

As leituras da busca usam `networkMode: "always"`: com o padrão do TanStack Query, a leitura fica pausada quando o navegador se diz sem rede, mesmo com o servidor no mesmo computador, e a tela ficaria parada sem erro.

## Arquivados e anonimizado

Por padrão a busca traz só ativos; perfil de cliente arquivado segue o cliente. "Incluir arquivados" (`arquivados=1` na URL) traz os dois, com os ativos primeiro e o selo nos arquivados. Cliente anonimizado, os perfis e os orçamentos dele nunca entram: o filtro olha `anonymized_at`, e o nome antigo já não existe, porque a anonimização regrava o `search_text` com "Cliente anonimizado" e os perfis com "Perfil anonimizado" ([agregados](agregados.md#redação-de-dado-pessoal)). A busca vai por POST, e o log do servidor registra só o caminho da leitura, nunca o texto buscado.

## Busca offline

O snapshot do `change_log` não leva `search_text`. Na F6, o aparelho monta as chaves pelas mesmas funções de chave de cada área (`searchKey`, `materialSearchKey`, `variantSearchKey`, `productSearchKey`, `productVariantSearchKey`, `serviceSearchKey`) e casa com `matchesAll`, `matchedVariants` e `highlightRanges`, a mesma regra do servidor.

## Armadilhas

| Sintoma | Causa | Como evitar |
|---|---|---|
| A busca e a lista da área acham coisas diferentes para a mesma palavra | Busca e lista com filtros ou ordens próprios | Uma função de filtro por área, chamada pelas duas, e teste que compara os primeiros da busca com os da lista |
| Perfil com acento não aparece | `lower()` do SQLite só converte ASCII, e `client_profile` não tem `search_text` | Filtrar os perfis em memória por `matchesAll`, com a normalização do domínio |
| `%` ou `_` digitados acham tudo | Curinga do `LIKE` sem escape | `containing` escapa `%`, `_` e `\`, com teste de "a_a", "a%a" e de códigos com `_` |
| Consulta só de pontuação traz os primeiros de cada grupo | `searchTokens("--")` devolve lista vazia, e filtro sem palavra casa tudo | Sem palavra, as duas leituras devolvem vazio |
| Importar `@costura-pro/domain/search` falha fora do editor | Módulo novo do domínio sem entrada no `exports` do `packages/domain/package.json` | Cada módulo do domínio tem a própria entrada, com `types` no `dist` e `default` no `src` |
| Trecho marcado fora do lugar em nome com acento | Intervalos achados no texto normalizado aplicados ao original, que tem outro tamanho quando o acento vem decomposto | `highlightRanges` guarda o início e o fim do caractere original de cada unidade normalizada, com teste em NFD |
| O alerta de erro da busca demora alguns segundos | O `QueryClient` repete a leitura 3 vezes antes do erro | Esperado; a verificação derruba todas as tentativas pelo domínio `Fetch` do CDP, ou desliga a rede com `Network.emulateNetworkConditions`, até o alerta aparecer |
| O campo da página volta ao texto antigo depois do "Ver todos" do diálogo | A espera de 300 ms comparava o texto digitado com a URL nova e gravava o texto velho | Um ref guarda o último valor que a própria página gravou; mudança de fora da URL substitui o texto |

---
name: verificar
description: Roda a bateria de verificação do Costura Pro com saída em arquivo e resumo por comando. Use antes de declarar pronto, antes de commit ou integração e quando /entrega-fechar pedir.
---

# Verificar

Rode um comando por vez, sempre redirecionando a saída para um arquivo do scratchpad (`> arquivo.log 2>&1`), e leia o arquivo com Read ou Grep. Suíte de teste nunca passa por pipe.

| Ordem | Comando | Verde quando |
|---|---|---|
| 1 | `pnpm harness:check` | "Harness consistente." |
| 2 | `pnpm docs:check` | "Docs consistentes." |
| 3 | `pnpm harness:test` | `fail 0` |
| 4 | `pnpm test` | todas as tarefas do turbo com sucesso |
| 5 | `pnpm check` | "No fixes applied" e nenhum erro |
| 6 | `pnpm check-types` | todas as tarefas com sucesso |
| 7 | `pnpm build` | todas as tarefas com sucesso e nenhum aviso novo |

Interface alterada: valide também com browser-harness em 320 px e no desktop, por toque e teclado.

Pronto quando cada linha da tabela tiver o resultado observado. Falha segue para `superpowers:systematic-debugging`; nunca a classifique como instável sem reproduzir.

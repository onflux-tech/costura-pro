# Costura Pro

App local-first para um único ateliê e um único dono: atendimento, orçamento, OS, OP, venda direta, estoque, finanças e documentos não fiscais. Não é SaaS e não emite documento fiscal. A fase atual e o próximo trabalho estão em `docs/ROADMAP.md`.

## Documentos

| Arquivo | Leia quando |
|---|---|
| `CONTEXT.md` | Ao nomear qualquer conceito do domínio |
| `docs/PRD.md` | Ao mudar comportamento: requisitos na §6, decisões na §9, questões em aberto na §12 |
| `docs/SPEC.md` | Ao implementar um contrato; o que já existe versus o previsto está na §0 |
| `docs/ROADMAP.md` | Ao escolher trabalho: fase, spikes, critério de saída e definição de pronto |
| `docs/adr/` | Ao mexer em fronteira difícil de reverter (origem da PWA, OS e OP, movimentos, backup e epoch, atualização, SQLite, serviços, documentos emitidos, códigos, dinheiro) |
| `docs/HARNESS.md` | Ao mexer em papéis, skills, MCP ou gerador; também traz "antes de mexer em X, leia Y" e as falhas silenciosas conhecidas |
| `docs/REFERENCIAS.md` | Ao precisar de versão de biblioteca, alternativa descartada ou fonte externa |

## Invariantes

- Dados do usuário são preservados: banco, backups, fotos, PDFs e `.env`. Schema muda só por migration para a frente (`pnpm db:generate` e `pnpm db:migrate`); `db:push` só em banco descartável.
- Dinheiro em centavos `bigint` e quantidade em milionésimos da unidade base `bigint`; no JSON, os dois viajam como string decimal.
- Movimentos de estoque e finanças e documentos emitidos são imutáveis; correção é estorno, revisão ou ajuste.
- Todo comando que muda estado é idempotente por `opId` e confere a versão-base.
- Custos internos e margens aparecem só para o dono.

## Como trabalhar

- TDD para lógica e comportamento novos: `bun test` no domínio, SQLite real em diretório temporário na integração.
- Mudança de comportamento segue a rota completa do `docs/HARNESS.md` §4. Specs e planos de sessão ficam em `docs/superpowers/`, local e fora do git.
- TypeScript e React seguem a skill `ultracite`. Interface é validada em navegador real com browser-harness, em 320 px e no desktop.
- Pronto significa testes relevantes, `pnpm check-types`, `pnpm check` e `pnpm build` sem erro nem aviso; `pnpm fix` corrige formatação.
- Escolha ou confirmação do dono vai pela ferramenta de pergunta do cliente, com a opção recomendada primeiro.
- Commit, push e PR só quando o dono pedir; mensagens de commit em inglês no padrão conventional commits.

## Subagentes

Até 2 por tarefa, somente leitura, para trabalho independente e delimitado: `explorer` para mapear um fluxo, `reviewer` para revisar um diff, `contract` quando a mudança cruza camadas.

## Harness

`.agents/agents/`, `.agents/skills/`, `.mcp.json` e `scripts/harness.mjs` são as fontes. `.claude/agents/`, `.claude/skills/` e `.codex/` são portas geradas: edite a fonte, rode `pnpm harness:sync`, confirme com `pnpm harness:check` e versione fonte e portas juntas. MCPs e credenciais deste projeto são próprios: nada copiado de outro projeto nem sincronizado entre clientes, e segredos ficam fora do git.

## Escrita dos documentos

- Português do Brasil e datas absolutas (2026-09-16).
- Pontuação com vírgula, dois-pontos, parênteses ou ponto; travessão (U+2014) e meia-risca (U+2013) ficam fora dos docs, commits e PRs.
- Docs versionados apontam só para arquivos versionados.
- Afirmação sobre fonte externa leva link e data de consulta.

## Quando uma decisão muda

Atualize na mesma mudança:

1. `docs/PRD.md`: a linha na §9 e todo requisito, critério ou risco afetado;
2. `docs/ROADMAP.md`: fase, spike, critério de saída e a tabela de rastreio;
3. `docs/SPEC.md`: o contrato e a linha da §0;
4. `CONTEXT.md`: termo novo ou com sentido alterado;
5. `docs/adr/`: ADR novo, ou `status: superseded` no antigo, quando a decisão é de mão única;
6. `docs/REFERENCIAS.md`: biblioteca, versão ou fonte.

Depois confira que todo requisito novo aparece no rastreio do ROADMAP.

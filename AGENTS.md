# Costura Pro

App local-first para um único ateliê e um único dono: atendimento, orçamento, OS, OP, venda direta, estoque, finanças e documentos não fiscais. Não é SaaS e não emite documento fiscal.

## Onde está cada coisa

- `docs/README.md` é o índice curado de toda a documentação, com "leia quando".
- Mínimo para qualquer mudança: `docs/ROADMAP.md` (o que fazer e critério de saída), `docs/SPEC.md` §0 (o que já existe) e `CONTEXT.md` (nomes do domínio).
- `docs/HARNESS.md`: papéis, skills, hooks, verificação, "antes de mexer em X, leia Y" e falhas silenciosas conhecidas.

## Ciclo de entrega

Toda implementação segue as skills do projeto (fonte em `.agents/skills/`; no Claude, `/nome`):

1. `entrega-iniciar`: escolhe a entrega do ROADMAP, cria a branch, define a rota e a spec local.
2. `verificar` e, quando a entrega toca dinheiro, quantidade, dados, autenticação, sync ou contrato entre camadas, `revisar`.
3. `entrega-fechar`: atualiza docs curadas e índice e evolui o harness pelos critérios do `docs/HARNESS.md` §4. É o que deixa o harness mais especialista a cada entrega.
4. `integrar-branch`: roda sozinho logo depois do `entrega-fechar` verde, com commits por área, merge `--ff-only` na `main`, push e CI acompanhado, sem pedir confirmação; não há PR.

## Regras por área

Antes de tocar arquivos de uma área, leia a rule dela (no Claude elas carregam sozinhas pelo `paths:`):

| Rule | Área |
|---|---|
| `.claude/rules/domain.md` | `packages/domain` |
| `.claude/rules/db.md` | `packages/db` |
| `.claude/rules/server.md` | `apps/server`, `packages/api`, `packages/auth` |
| `.claude/rules/web.md` | `apps/web`, `packages/ui` |
| `.claude/rules/docs.md` | `docs`, markdown da raiz, rules e papéis |
| `.claude/rules/harness.md` | `.agents`, `.claude`, `.codex`, `scripts`, `.github`, MCP e Lefthook |

## Invariantes

- Dados do usuário são preservados: banco, backups, fotos, PDFs e `.env`. Schema muda só por migration para a frente (`pnpm db:generate` e `pnpm db:migrate`); `db:push` só em banco descartável.
- Dinheiro em centavos `bigint` e quantidade em milionésimos da unidade base `bigint`; no JSON, os dois viajam como string decimal.
- Movimentos de estoque e finanças e documentos emitidos são imutáveis; correção é estorno, revisão ou ajuste.
- Todo comando que muda estado é idempotente por `opId` e confere a versão-base.
- Custos internos e margens aparecem só para o dono.

## Como trabalhar

- TDD para lógica e comportamento novos: `bun test` no domínio, SQLite real em diretório temporário na integração.
- TypeScript e React seguem a skill `ultracite`. Interface é validada em navegador real com browser-harness, em 320 px e no desktop.
- Código sai sem comentários, inclusive os de porquê: o conhecimento não óbvio vira armadilha no `docs/HARNESS.md` §8, na rule da área ou na SPEC. O guard do Claude barra comentário novo.
- Pronto significa `pnpm harness:check`, `pnpm docs:check`, `pnpm harness:test`, `pnpm test`, `pnpm check`, `pnpm check-types` e `pnpm build` sem erro nem aviso; `pnpm fix` corrige formatação.
- Suíte de teste roda com saída redirecionada para arquivo, nunca com pipe.
- Escolha ou confirmação do dono vai pela ferramenta de pergunta do cliente, com a opção recomendada primeiro.
- Commit, merge na `main` e push acontecem automaticamente ao fim de cada entrega, pelo `integrar-branch` (autorização permanente do dono); mensagens de commit em inglês no padrão conventional commits.

## Subagentes

Até 2 por tarefa, somente leitura, para trabalho independente e delimitado: `explorer` para mapear um fluxo, `reviewer` para revisar um diff, `contract` quando a mudança cruza camadas.

## Harness

`.agents/agents/`, `.agents/skills/`, `.mcp.json` e `scripts/harness.mjs` são as fontes. `.claude/agents/`, `.claude/skills/` e `.codex/` são portas geradas: edite a fonte, rode `pnpm harness:sync`, confirme com `pnpm harness:check` e versione fonte e portas juntas. MCPs e credenciais deste projeto são próprios: nada copiado de outro projeto nem sincronizado entre clientes, e segredos ficam fora do git.

## Escrita dos documentos

- Português do Brasil e datas absolutas (2026-09-16); o `README.md` da raiz é bilíngue (EN/PT) por ser a página pública.
- Pontuação com vírgula, dois-pontos, parênteses ou ponto; travessão (U+2014) e meia-risca (U+2013) ficam fora de docs, commits e PRs.
- Docs versionados apontam só para arquivos versionados; doc novo entra no índice `docs/README.md`.
- Afirmação sobre fonte externa leva link e data de consulta.

## Quando uma decisão muda

Atualize na mesma mudança:

1. `docs/PRD.md`: a linha na §9 e todo requisito, critério ou risco afetado;
2. `docs/ROADMAP.md`: fase, spike, critério de saída e a tabela de rastreio;
3. `docs/SPEC.md`: o contrato e a linha da §0;
4. `CONTEXT.md`: termo novo ou com sentido alterado;
5. `docs/adr/`: ADR novo, ou `status: superseded` no antigo, quando a decisão é de mão única;
6. `docs/REFERENCIAS.md`: biblioteca, versão ou fonte;
7. `docs/README.md`: doc novo ou renomeado.

`pnpm docs:check` confere índice, links, caminhos citados, travessões, rules listadas, rastreio de requisitos e papéis e skills documentados.

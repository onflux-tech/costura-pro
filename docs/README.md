# Índice da documentação

Documentação curada e versionada do Costura Pro. Todo doc novo em `docs/` entra aqui na mesma mudança; o `pnpm docs:check` reprova o que ficar fora. Specs, planos e handoffs de sessão ficam em `docs/superpowers/`, fora do git.

## Produto e planejamento

| Documento | Leia quando |
|---|---|
| [PRD](PRD.md) | Ao mudar comportamento: requisitos na §6, não funcionais na §7, aceite na §8, decisões na §9, riscos, métricas e questões em aberto |
| [ROADMAP](ROADMAP.md) | Ao escolher o próximo trabalho: fases, spikes, critérios de saída, rastreio de requisitos e definição de pronto |
| [Glossário](../CONTEXT.md) | Ao nomear qualquer conceito do domínio |

## Engenharia

| Documento | Leia quando |
|---|---|
| [SPEC](SPEC.md) | Ao implementar um contrato; o estado atual versus previsto está na §0 |
| [REFERENCIAS](REFERENCIAS.md) | Ao precisar de versão, alternativa descartada, fonte externa ou origem de uma decisão |

## Decisões difíceis de reverter (ADRs)

| ADR | Assunto |
|---|---|
| [0001](adr/0001-origem-canonica-e-local-first.md) | Origem HTTPS única para a PWA local-first |
| [0002](adr/0002-os-op-e-venda-direta.md) | Separar OS, OP e venda direta |
| [0003](adr/0003-movimentos-imutaveis-e-custo-provisorio.md) | Movimentos imutáveis e custo provisório |
| [0004](adr/0004-backup-epoch-e-cofre-por-dispositivo.md) | Restauração com epoch e cofre por dispositivo |
| [0005](adr/0005-atualizacao-coordenada.md) | Atualizar binários e banco em conjunto |
| [0006](adr/0006-sqlite-nativo-bun.md) | SQLite nativo do Bun como fonte autoritativa |
| [0007](adr/0007-servico-do-so-e-tauri-administrativo.md) | Servidor como serviço do sistema e Tauri administrativo (substituído pelo 0011) |
| [0008](adr/0008-documentos-emitidos-imutaveis.md) | Documentos emitidos imutáveis, inclusive offline |
| [0009](adr/0009-uuid-e-codigo-documental-por-dispositivo.md) | UUID e código documental por dispositivo |
| [0010](adr/0010-dinheiro-e-quantidade-inteiros.md) | Dinheiro e quantidade inteiros |
| [0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md) | Servidor como serviço do sistema e acesso local pelo navegador |
| [0012](adr/0012-dono-unico-criado-no-acesso-local.md) | Dono único criado no acesso local, com login defendido no servidor |
| [0013](adr/0013-contrato-minimo-de-sincronizacao.md) | Contrato mínimo de sincronização por operação, cursor e epoch |
| [0014](adr/0014-anonimizacao-redige-historico-de-sincronizacao.md) | Anonimização redige o histórico de sincronização |
| [0015](adr/0015-medidas-em-milimetros-e-medicao-autocontida.md) | Medidas em milímetros inteiros e medição autocontida |
| [0016](adr/0016-midia-enderecada-por-conteudo.md) | Mídia endereçada por conteúdo, com rota própria e apagamento sem promessa forense |
| [0017](adr/0017-dinheiro-e-quantidade-em-coluna-inteira.md) | Dinheiro e quantidade em coluna inteira do SQLite e inteiro em string no JSON |
| [0018](adr/0018-movimento-append-only-com-projecao-de-saldo.md) | Movimento de estoque append-only com projeção de saldo na mesma transação |
| [0019](adr/0019-compra-e-obrigacao-como-fatos-imutaveis.md) | Compra, obrigação e estorno como fatos imutáveis, com estado derivado |

## Agentes e harness

| Documento | Leia quando |
|---|---|
| [HARNESS](HARNESS.md) | Ao mexer em papéis, skills, MCP, hooks ou checagens, abrir uma sessão nova ou aplicar os critérios de evolução no fechamento |
| [Instruções para agentes](../AGENTS.md) | Sempre: invariantes, regras por área e ciclo de entrega |

## Docs por área

Quando uma área acumular conhecimento que não cabe numa rule, o `/entrega-fechar` cria o doc em `docs/areas/<area>.md` e o lista aqui.

| Documento | Leia quando |
|---|---|
| [Design system](areas/design-system.md) | Antes de criar ou mudar tela, componente, token ou navegação: tokens, componentes, testes que travam as regras e o passo a passo de uma tela nova |
| [Agregados](areas/agregados.md) | Antes de criar ou mudar um agregado de negócio: tabela, store, snapshot, comandos nos dois caminhos, decisões por caminho, redação de dado pessoal e testes mínimos |
| [Mídia](areas/midia.md) | Antes de mexer em foto, upload, arquivo em disco, coleta ou remoção de mídia: parâmetros de captura, rotas, gravação atômica, coleta, anonimização e armadilhas |
| [Catálogo de materiais](areas/catalogo.md) | Antes de mexer em material, variante, unidade base, dinheiro ou quantidade: como o valor inteiro atravessa as camadas, campos dos dois agregados, foto da variante e armadilhas |
| [Estoque](areas/estoque.md) | Antes de mexer em local, lote, movimento ou saldo: agregados e projeção, tipos de movimento, valor de saída pela média, lote por variante, estorno e armadilhas |
| [Compras](areas/compras.md) | Antes de mexer em fornecedor, compra, conversão de embalagem, rateio de frete e desconto, obrigação ou estorno de compra: agregados, contas do custo de aquisição, comandos, telas e armadilhas |
| [Finanças](areas/financas.md) | Antes de mexer em conta financeira, movimento financeiro, saldo de conta, transferência, pagamento ou estado da obrigação: agregados, tipos de movimento, obrigação a pagar, telas e armadilhas |

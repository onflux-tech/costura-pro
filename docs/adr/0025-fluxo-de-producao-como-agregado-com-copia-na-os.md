---
status: accepted
date: 2026-09-25
---

# Fluxo de produção como agregado com cópia na OS, e produção em colunas do subitem

O RF-PRO-01 pede um fluxo de produção versionado, comum a OS e OP, que o dono renomeia, reordena, oculta e amplia gerando versão nova; o RF-PRO-02 pede que cada ordem guarde a versão com que nasceu e só troque por migração manual; o RF-PRO-03 pede que cada subitem da OS avance sozinho. O [ADR 0024](0024-aprovacao-como-fato-que-cria-a-os.md) já fez a OS e o subitem agregados comuns com versão para isso. Antes do schema era preciso decidir onde mora a versão do fluxo, o que a OS guarda dela e se o avanço é fato ou estado.

**Fluxo.** `production_flow` é um agregado de uma linha, com a lista de etapas em JSON (`{ active, id, name }[]`) e o `version` do agregado como versão do fluxo. O id de cada etapa é um UUID gerado no aparelho e estável entre versões; ocultar deixa `active: false` e a etapa nunca sai da lista. A edição reenvia as ativas na ordem e o servidor funde com `mergeFlowStages`, no molde do modelo de medidas ([ADR 0015](0015-medidas-em-milimetros-e-medicao-autocontida.md)): as ausentes do envio ficam ocultas, com o nome gravado. O boot semeia a versão 1 uma única vez, com Corte, Montagem, Prova e Acabamento.

**Cópia na OS.** A aprovação grava na OS `flow_version` e a cópia inteira de `flow_stages`, ocultas inclusive, lidas na mesma transação. A OS mostra os nomes e a ordem da própria versão mesmo depois que o fluxo muda, e `serviceOrder.adoptCurrentFlow` troca a cópia pela vigente sem mexer nas etapas que os subitens já escolheram, porque os ids são estáveis. A OS aprovada antes desta mudança fica com fluxo nulo e adota o vigente pelo mesmo comando.

**Produção no subitem.** `production_status` (`notStarted`, `inProgress`, `ready`), `stage_ids` (as aplicáveis, congeladas na ordem do fluxo da OS) e `stage_id` (a atual) são colunas do subitem, editadas pelos comandos `serviceOrderItem.start`, `advance` e `back` por `updateCommands`, com a versão-base conferida pelo caminho comum. O `read` de cada comando junta o `flow_stages` da OS e a anonimização do cliente; a transição que não se aplica é "sem efeito", não recusa, e o subitem de material responde não encontrado. O "Pronto" de subitem com material planejado fica sem efeito até a reconciliação.

## Opções consideradas

- **Tabela de versões do fluxo, com a OS guardando só o número:** guardaria o histórico inteiro sem copiar nada na OS, mas cada leitura da OS e do quadro juntaria outra tabela, e o fluxo precisaria de um comando de criação de versão fora do caminho comum de edição.
- **Avanço como fato append-only que atualiza o subitem:** daria o histórico e o tempo por etapa, que ainda não são pedidos, ao custo de uma tabela, de triggers e de uma projeção; o estado em colunas guarda o que a tela precisa, e o histórico pode nascer depois sem migrar o que existe.
- **Atribuir a versão 1 à OS antiga no boot:** evitaria o estado sem fluxo, mas escreveria em OS que o dono não tocou e esconderia que ela nasceu antes do fluxo.

## Consequências

- A cópia na OS repete a lista a cada aprovação; com até 12 ativas e as ocultas acumuladas, o custo é pequeno e a OS se lê sozinha.
- Sem histórico de etapas: quem avançou e quando fica só no `change_log`; tempo por etapa e histórico entram como fato novo se forem pedidos.
- A OP da F5 recebe a mesma cópia do fluxo e as mesmas funções de domínio (`startProduction`, `advanceProduction`, `backProduction`).
- A reconciliação, quando existir, libera o "Pronto" da peça com material mudando só a regra do `advanceProduction`.
- O snapshot de `serviceOrder` e `serviceOrderItem` gravado antes da migration `0020` chega no `sync.pull` sem os campos novos até a próxima escrita; o consumidor aplica fluxo nulo, `notStarted` e escolha nula.

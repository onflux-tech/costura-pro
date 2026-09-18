---
status: accepted
date: 2026-09-18
---

# Serviço versionado pelo próprio agregado e preço sugerido calculado na leitura

O serviço guarda custo interno (ou custo estimado, no terceirizado) e preço praticado separados (RF-CAT-01, DEC-14), e o dono vê um preço sugerido pela margem sobre a venda (RF-CAT-11, DEC-16). Duas perguntas precisavam de resposta antes do schema: o que é a "versão" que a RF-CAT-01 pede, e onde mora o preço sugerido.

**Versão.** A versão do serviço é a `version` do próprio agregado, que já sobe a cada edição para o compare-and-set do sync ([ADR 0013](0013-contrato-minimo-de-sincronizacao.md)). Não há tabela de versões: o orçamento da F4 copia nome, custo, preço e versão do serviço na própria linha, como a medição copia nome, versão e rótulos do modelo de medidas ([ADR 0015](0015-medidas-em-milimetros-e-medicao-autocontida.md)). Editar o serviço depois nunca muda um orçamento já feito.

**Preço sugerido.** A sugestão não é gravada. O servidor guarda custo, preço praticado e a meta própria opcional do serviço, e a meta do ateliê fica numa coluna da instalação, com padrão de 40%. A tela calcula a sugestão, a margem do preço praticado e os avisos de abaixo da meta e abaixo do custo com uma única função do domínio (`pricingOf` em `packages/domain/src/pricing.ts`), a partir da meta própria ou, sem ela, da do ateliê. Nenhum comando muda o preço praticado a partir de uma meta ou de um custo novo (RF-CAT-12).

## Opções consideradas

- **Tabela de versões imutáveis, referenciada pelo orçamento:** daria um histórico de preços consultável, mas acrescenta uma tabela, um fluxo de criação de versão e uma chave estrangeira que o orçamento autocontido dispensa.
- **Versão nova só quando uma versão usada em orçamento é editada:** depende de o orçamento existir, e o servidor precisaria saber o uso de cada versão antes de aceitar uma edição, o que não cabe em `updateCommands` sem caminho de rejeição.
- **Preço sugerido gravado no serviço:** a sugestão ficaria velha a cada mudança de meta ou de custo, e manter a coluna em dia exigiria reescrever serviços a partir de um comando da instalação.
- **Meta só por serviço, só global ou por categoria:** só por serviço obriga editar um a um para mudar a estratégia; só global não cobre o terceirizado de margem menor; por categoria exigiria categoria como cadastro próprio.
- **Agregado próprio de configurações para a meta do ateliê:** mais limpo se muitas preferências vierem, mas é um agregado inteiro para um número; a instalação já é o registro único do ateliê e já viaja no sync.

## Consequências

- Mudar a meta do ateliê (`installation.setTargetMargin`) sobe só a versão da instalação: nenhum serviço muda de versão nem de preço. A mesma meta enviada de novo não escreve.
- A versão da instalação passa a ser compartilhada entre o nome do ateliê e a meta: editar os dois em aparelhos diferentes sem sincronizar vira conflito, resolvido pela caixa de conflitos como qualquer outro.
- A lista de serviços não filtra "abaixo da meta" no servidor. Se esse filtro for preciso, a comparação cabe em SQL sem arredondamento (`preço × (10000 − meta) < custo × 10000`), com teste contra `pricingOf`.
- O orçamento da F4 copia o que o dono viu na linha; a margem estimada congelada na aprovação parte dessa cópia, e não da leitura atual do serviço.

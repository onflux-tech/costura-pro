# PRD: Costura Pro

| Campo | Valor |
|---|---|
| Status | **Aprovado pelo dono em 2026-09-15.** A v1 é entregue em fases internas e só é chamada de completa quando todos os critérios da [§8](#8-critérios-de-aceitação-da-v1) passarem |
| Tipo | Produto e regras de negócio. Contratos técnicos na [SPEC](SPEC.md); ordem de entrega no [ROADMAP](ROADMAP.md) |
| Glossário | [CONTEXT.md](../CONTEXT.md): os termos em negrito seguem esse vocabulário |
| Decisões difíceis de reverter | [docs/adr/](adr/) |
| Origem | Brainstorming e grill com o dono em 2026-09-14 e 2026-09-15 (resumo em [REFERENCIAS §4](REFERENCIAS.md#4-origem-das-decisões)) |
| Idioma, moeda e fuso | Português do Brasil, BRL, America/Recife (editável na configuração do ateliê) |

## Sumário

1. [Resumo](#1-resumo)
2. [Contexto](#2-contexto)
3. [Objetivos, não-objetivos e restrições](#3-objetivos-não-objetivos-e-restrições)
4. [Dono e cenários de uso](#4-dono-e-cenários-de-uso)
5. [Princípios de produto](#5-princípios-de-produto)
6. [Escopo funcional](#6-escopo-funcional)
7. [Requisitos não funcionais](#7-requisitos-não-funcionais)
8. [Critérios de aceitação da v1](#8-critérios-de-aceitação-da-v1)
9. [Registro de decisões](#9-registro-de-decisões)
10. [Riscos e mitigação](#10-riscos-e-mitigação)
11. [Métricas de sucesso](#11-métricas-de-sucesso)
12. [Questões em aberto](#12-questões-em-aberto)
13. [Glossário](#13-glossário)

---

## 1. Resumo

O Costura Pro ajuda o dono de **um único ateliê de costura** a atender clientes, planejar trabalhos, controlar materiais e peças acabadas, calcular preço e margem, registrar caixa e emitir documentos não fiscais com pouco atrito. Não é SaaS, não tem funcionários nem clientes como usuários e não emite nota fiscal.

Forma do produto:

- **Um PC Windows é a autoridade dos dados** e opera sem internet. Ubuntu 24.04 LTS é plataforma validada.
- **Uma única interface web** roda no navegador do PC, pela origem local em loopback, e no celular, instalada como PWA.
- **O celular funciona offline** depois da primeira sincronização: grava num cofre cifrado e sincroniza por fila idempotente quando o Cloudflare Tunnel está alcançável ([ADR 0001](adr/0001-origem-canonica-e-local-first.md), [ADR 0004](adr/0004-backup-epoch-e-cofre-por-dispositivo.md)).
- **Estoque e finanças são movimentos imutáveis**; saldos são projeções ([ADR 0003](adr/0003-movimentos-imutaveis-e-custo-provisorio.md)).
- **Documentos emitidos são congelados**, inclusive quando emitidos offline ([ADR 0008](adr/0008-documentos-emitidos-imutaveis.md)).
- **Instalação simples:** servidor e Tunnel como serviços do sistema, backup diário e atualização coordenada com reversão ([ADR 0005](adr/0005-atualizacao-coordenada.md), [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md)).

## 2. Contexto

Pedido original do dono (2026-09-14): um app para gerenciar um único ateliê, rodando localmente na maior parte do tempo e acessível por subdomínio próprio via Cloudflare Tunnel; sem necessidade de escala ou alta performance, mas **bonito, prático e fácil de usar**. Precisa cadastrar materiais de costura (tecidos, linhas, bainhas, franjas, zíperes, botões), custo de serviço e estoque, gerar orçamento em PDF tanto em formato de cupom quanto em A4 bem formatado, e fazer backup diário numa pasta escolhida pela interface. Windows quase sempre, com compatibilidade Linux desejada. Todo o desenvolvimento é assistido por IA.

O grill de 2026-09-15 ampliou o domínio além do pedido inicial: além de trabalhos sob medida e consertos, o ateliê **produz peças e kits para estoque e vende produtos prontos**, recebe peças de clientes sob custódia e precisa separar faturamento, custo e caixa sem virar contabilidade formal.

## 3. Objetivos, não-objetivos e restrições

### 3.1 Objetivos

1. O dono conclui a jornada cliente → orçamento → aprovação → OS → consumo → entrega → recebimento **sem planilha**.
2. O dono produz acabado por OP, vende uma variante pronta e vê estoque, custo e margem coerentes.
3. Uma venda, foto ou PDF criado no celular offline reaparece **uma única vez** no servidor depois do sync, ou cai numa exceção visível, sem desaparecer.
4. O backup diário é restaurável e contém dados e arquivos; uma atualização malsucedida não deixa servidor, serviços e banco em versões incompatíveis.
5. Todas as telas são usáveis por toque em Android e iPhone e por mouse e teclado em Windows e Ubuntu.
6. A interface é bonita, clara e rápida de usar no dia a dia do ateliê.

### 3.2 Não-objetivos

- SaaS, multiempresa, funcionários ou múltiplos usuários com permissões.
- Portal, conta ou link público para cliente.
- Nota fiscal, API fiscal ou integração contábil.
- Envio automático de WhatsApp ou e-mail; toda mensagem é revisada e enviada pelo dono.
- Integração com maquininha de cartão ou impressão direta por driver.
- Importação ou exportação CSV na v1.
- Pedido formal a fornecedor, recebimento parcial de pedido de compra e parcelamento de fornecedor.
- Rateio de despesas gerais entre trabalhos.
- Push móvel em background com o app fechado.
- Sincronização do celular pela rede local.
- App móvel nativo e compromisso de alta escala.

### 3.3 Restrições

- Um dono, um ateliê, um PC servidor.
- Windows é a plataforma principal; Ubuntu 24.04 LTS, Chrome Android e Safari iPhone são alvos formais de validação.
- O dono **não tem acesso administrativo ao roteador** do ateliê; nada pode depender de DNS local ou abertura de porta.
- Acesso remoto e sincronização móvel dependem de internet e de um domínio do dono na Cloudflare.
- Sem certificado comercial de assinatura de código na v1; atualizações têm assinatura própria.
- Releases públicos no GitHub não podem conter dados do ateliê.

## 4. Dono e cenários de uso

**Dono:** única pessoa que usa o sistema. Atende no balcão, costura, compra material, faz provas e visitas e cuida do caixa. Não é técnico: instalação, backup e atualização não podem exigir terminal.

| Cenário | Onde | Conexão |
|---|---|---|
| Atender cliente, receber peça, montar orçamento e emitir PDF | PC (navegador) ou celular | Com ou sem internet |
| Fazer prova ou visita, anotar medidas e fotografar a peça | Celular | Frequentemente sem internet |
| Registrar consumo, avançar etapa e entregar subitem | PC ou celular | Qualquer |
| Vender produto pronto e receber pagamento | PC ou celular | Qualquer; vendas concorrentes offline são possíveis |
| Receber compra de material e ajustar estoque | PC ou celular | Qualquer |
| Conferir caixa e relatórios | PC ou celular | Qualquer |
| Backup, restauração, dispositivos, Tunnel e atualização | PC | Local; administração só no acesso local do PC |

## 5. Princípios de produto

- **Nada confirmado desaparece.** Fatos concorrentes viram exceções visíveis, nunca descarte silencioso.
- **O dono decide; o sistema sugere e alerta.** Preço sugerido, lote FIFO e etapas são sugestões. Margem abaixo da meta, sobrecarga de agenda e conflito de horário pedem confirmação em vez de bloquear.
- **O passado não se reescreve.** Revisões, estornos e ajustes registram mudanças; documentos emitidos e movimentos ficam como foram.
- **Operação de hoje primeiro.** A tela inicial mostra o que exige ação; finanças ficam em segundo plano.
- **Honestidade sobre limites.** O que depende do PC ou do navegador (retenção de dados móveis, push, backup) é dito na interface.
- **Nada sai para o cliente sem o dono.** Mensagens são preparadas e enviadas manualmente; custos internos nunca aparecem.
- **Toque e teclado em tudo.** Nenhuma ação essencial depende de hover, gesto oculto ou rolagem horizontal.

## 6. Escopo funcional

Requisitos têm ID estável para rastreio no [ROADMAP](ROADMAP.md). Contratos de implementação estão na [SPEC](SPEC.md).

### 6.1 Primeira experiência e navegação (RF-ENT)

- **RF-ENT-01** O instalador registra e inicia o servidor como serviço e cria o atalho que abre a interface no navegador do PC.
- **RF-ENT-02** O primeiro acesso abre o **wizard inicial**, retomável, com progresso e prévia real do resultado. Antes de liberar o dashboard são obrigatórios: nome do ateliê, conta com senha, emissão e guarda dos códigos de recuperação e escolha e teste da pasta de backup.
- **RF-ENT-03** O **checklist de continuidade** oferece depois: logo, telefone, endereço, cores, contas financeiras, saldos de abertura, materiais, serviços, produtos e Tunnel.
- **RF-ENT-04** A **sandbox de demonstração** é descartável, isolada da base real, repetível e inclui cliente, peça recebida, orçamento, OS, OP e venda.
- **RF-ENT-05** Navegação principal: Hoje, Agenda, Atendimento, Orçamentos, OS, Produção, Vendas, Catálogo, Estoque, Compras, Finanças, Relatórios e Configurações.
- **RF-ENT-06** No celular, navegação inferior para destinos frequentes e menu para os demais; tabelas viram cartões e formulários longos mantêm a ação principal alcançável.
- **RF-ENT-07** Ações rápidas a partir de Hoje e da busca global: novo atendimento, orçamento, OS existente, consumo, venda, recebimento e ajuste de estoque.
- **RF-ENT-08** A busca global encontra clientes, telefones, orçamentos, OS, serviços, produtos e materiais, inclusive offline sobre os dados locais.
- **RF-ENT-09** Hoje prioriza prazos vencidos e próximos, capacidade sobrecarregada, OS bloqueada, faltas de material, entrega pendente, cobranças vencidas e falha de backup ou sync. Cartões financeiros são secundários.
- **RF-ENT-10** Alertas aparecem no app e, no PC, também como notificações do sistema enquanto a interface está aberta. Não há promessa de notificação no PC com a interface fechada nem de push móvel com o app fechado.

### 6.2 Atendimento, medidas, custódia e agenda (RF-ATD)

- **RF-ATD-01** Clientes são pessoas ou organizações com nome, contatos e notas.
- **RF-ATD-02** Um **cliente pagador** pode ter vários **perfis de usuário da peça**, cada um com medidas, fotos e histórico.
- **RF-ATD-03** **Modelos de medidas** vêm com modelos iniciais por tipo de peça e são personalizáveis (adicionar, renomear, ordenar, desativar campos) e versionados, sempre em centímetros.
- **RF-ATD-04** Cada subitem de OS congela o **snapshot de medidas** aprovado. Atualizar o perfil de quem tem trabalho ativo exige revisão da OS para mudar o snapshot.
- **RF-ATD-05** Fotos de condição da peça podem ser capturadas.
- **RF-ATD-06** Cliente com OS ou saldo aberto não pode ser excluído. O dono pode **arquivar** a qualquer momento e **anonimizar** quando não há trabalho nem saldo aberto, preservando o histórico financeiro.
- **RF-ATD-07** Na recepção de **peça recebida**, descrição, estado e quantidade são obrigatórios; fotos, acessórios e observações são opcionais. Datas de recepção e devolução e o responsável são registrados; o responsável é sempre o dono único (DEC-01, DEC-86).
- **RF-ATD-08** A recepção emite **comprovante de recepção** não fiscal em A4 ou 80 mm e **etiqueta de custódia** com código curto e QR de rota interna autenticada. O QR nunca contém dados pessoais nem abre página pública.
- **RF-ATD-09** **Compromissos** abrangem visita e prova, ligados ou não a cliente ou OS, com data, duração, lembrete, presença, notas e resultado.
- **RF-ATD-10** A agenda reúne compromissos, prazos de subitens e OPs e minutos estimados por serviço ou etapa, comparados à **capacidade diária** configurada, com alerta de sobrecarga no dia e na semana. Minutos servem só à agenda, nunca ao custo.
- **RF-ATD-11** Sobrecarga de capacidade e conflito de horário geram aviso com confirmação registrada, não bloqueio.
- **RF-ATD-12** O sistema prepara **mensagem** de lembrete ou retirada para WhatsApp ou compartilhamento; o dono revisa e envia manualmente.

### 6.3 Catálogo, ficha técnica e preço (RF-CAT)

- **RF-CAT-01** **Serviço** tem descrição, custo interno fixo e preço padrão separados, duração estimada, etapas sugeridas e versão. O custo exclui materiais listados na ficha.
- **RF-CAT-02** Serviço pode ser vendido sozinho ou compor produto ou trabalho.
- **RF-CAT-03** **Serviço terceirizado** usa custo estimado; a despesa real vinculada substitui a estimativa na margem real, sem somar.
- **RF-CAT-04** Materiais incluem tecido, linha, zíper, botão, franja, bainha, aviamento e categorias personalizáveis. **Material base** agrupa variantes como cor e tamanho.
- **RF-CAT-05** Cada **variante de material** tem código, imagem, unidade base configurável, precisão decimal de 0 a 6 casas, custo, saldo, mínimo e alvo.
- **RF-CAT-06** **Produtos base** representam roupas, kits e outros acabados. Cada **variante de produto** tem código, preço e estoque próprios, usa a **galeria compartilhada** do produto e pode ter capa própria.
- **RF-CAT-07** **Kit** vendido como uma unidade é um produto; subpeças só têm estoque se cadastradas como produtos próprios.
- **RF-CAT-08** A **ficha técnica** do produto base lista materiais ou variantes, quantidades, perda normal fixa ou percentual e serviços. A variante sobrescreve só as diferenças.
- **RF-CAT-09** A mesma ficha sugere componentes para orçamento sob medida e para OP de acabado. Mudanças feitas durante a produção não reescrevem a ficha vigente.
- **RF-CAT-10** **Insumo não controlado** aceita descrição e custo estimado opcional, sem movimento de estoque.
- **RF-CAT-11** **Preço sugerido** = custo estimado ÷ (1 − margem desejada sobre a venda). Exemplo: custo R$ 60 com meta de 40% sugere R$ 100.
- **RF-CAT-12** O **preço praticado** nunca muda automaticamente; o dono decide quando adotar a sugestão.
- **RF-CAT-13** Orçamento ou venda abaixo da meta ou abaixo do custo é permitido após alerta e confirmação.
- **RF-CAT-14** Desconto por linha ou por documento, em valor ou percentual, com motivo opcional, entra no cálculo da margem.
- **RF-CAT-15** Custos internos e margens nunca aparecem em documento ou tela destinada ao cliente.

### 6.4 Estoque e compras (RF-EST)

- **RF-EST-01** O saldo físico é controlado por variante, **local de estoque** e, opcionalmente, **lote**.
- **RF-EST-02** Locais (armário, prateleira, área) são configuráveis; transferências entre locais são auditadas.
- **RF-EST-03** Compra registra fornecedor, itens, custo unitário e referência opcional, mantendo histórico por fornecedor.
- **RF-EST-04** O recebimento aplica a **conversão de compra** da embalagem para a unidade base e rateia frete e desconto proporcionalmente no **custo de aquisição**.
- **RF-EST-05** A compra cria saída paga numa conta ou uma **obrigação de compra** com vencimento único. Ela eleva o valor do estoque, não o resultado imediato.
- **RF-EST-06** EAN externo pode ser registrado. QR e código de barras internos de materiais, lotes e variantes são lidos pela câmera e impressos em etiquetas.
- **RF-EST-07** A aprovação de OS cria **reservas previstas** sem reduzir o saldo físico; **disponibilidade** = físico − reservas.
- **RF-EST-08** Quando falta material, a aprovação reserva o disponível e cria **pendência de abastecimento** para o restante, sem inventar saldo.
- **RF-EST-09** A **lista de compras consolidada** soma faltas de OS e OP com a reposição até o alvo, explica a origem de cada quantidade sem duplicá-la e permite converter itens em compra recebida.
- **RF-EST-10** Reserva é por variante e não prende lote. No consumo, o sistema sugere o lote mais antigo com saldo e permite escolher outro ou dividir.
- **RF-EST-11** **Troca de material** registra previsto, usado, motivo e diferença de custo.
- **RF-EST-12** A **reconciliação de materiais** é obrigatória antes de marcar um subitem pronto e já vem preenchida com as quantidades planejadas: material retornável volta ao estoque; consumido e perdido não.
- **RF-EST-13** Inventário físico oferece **sessão de inventário** com prévia de divergências e **ajuste rápido** por item, ambos com motivo e movimentos auditados.
- **RF-EST-14** **Saldos de abertura** de variante, lote, local e contas financeiras são movimentos próprios, que não contam como compra nem faturamento.
- **RF-EST-15** Consumo legítimo pode deixar o estoque negativo com **custo provisório** e pendência de compra; a aquisição posterior gera **ajuste de custo** auditável sem reescrever o consumo.

### 6.5 Produção (RF-PRO)

- **RF-PRO-01** O **fluxo de produção** é versionado e comum a OS e OP. Vem com etapas iniciais que o dono pode renomear, reordenar, ocultar e adicionar; cada alteração gera nova versão. Produto e serviço sugerem **etapas aplicáveis**; o dono ajusta antes de iniciar e as não aplicáveis são puladas.
- **RF-PRO-02** Cada OS e OP recebe a versão vigente do fluxo ao ser criada e a mantém quando o fluxo muda; o dono pode migrar manualmente um trabalho existente para a versão nova.
- **RF-PRO-03** Produção mostra quadro por etapa e calendário de prazos. Na OS, cada subitem avança sozinho e a OS destaca o mais atrasado ou bloqueado.
- **RF-PRO-04** Uma **OP** tem produto e variante, ficha técnica, quantidade planejada, etapas aplicáveis, materiais e serviços consumidos e saídas parciais.
- **RF-PRO-05** **Unidades boas** entram no estoque de acabados e perdas definitivas são registradas. O custo consumido é rateado pelas unidades boas: 10 planejadas com 8 boas e 2 perdidas dividem o custo por 8.
- **RF-PRO-06** **Saída parcial de OP** usa custo provisório; o fechamento ajusta o custo das unidades.
- **RF-PRO-07** Acabado usa **custo médio da variante**; a venda congela o custo da unidade.
- **RF-PRO-08** OP pode consumir material com saldo negativo, com custo provisório e ajuste do custo do lote quando a compra cobrir o déficit.

### 6.6 Orçamento, OS e venda (RF-COM)

- **RF-COM-01** Orçamento aceita cliente, perfis e peças, serviços e produtos, quantidades, materiais sugeridos, prazo, desconto, observações e validade.
- **RF-COM-02** A composição pode mostrar preço por linha ou apenas o total agrupado, escolhido por linha.
- **RF-COM-03** Documentos e ordens têm **código documental** permanente e não sequencial por tipo, ano e dispositivo, como `ORC-2026-CEL-0042` ([ADR 0009](adr/0009-uuid-e-codigo-documental-por-dispositivo.md)).
- **RF-COM-04** Orçamento vencido exige revisão para renovar. **Aceite parcial** cria revisão com os itens aceitos antes da aprovação.
- **RF-COM-05** A **aprovação** registra data, canal e nota opcional; não exige assinatura nem sinal.
- **RF-COM-06** A aprovação cria uma **OS** agregadora com **subitens** independentes: peça, medidas, materiais, duração, prazo, etapas e entrega.
- **RF-COM-07** Estado de produção, estado de entrega e estado financeiro são separados; a OS só é encerrada quando os três estão resolvidos.
- **RF-COM-08** **Revisão comercial** (preço, material prometido ou prazo) exige nova aprovação; **revisão interna** (nota, etapa) não.
- **RF-COM-09** **Entrega parcial** ocorre por subitem e gera comprovante.
- **RF-COM-10** Cancelamento após execução abre **liquidação de cancelamento**: o dono escolhe materiais e serviços cobrados, classifica material retornado, consumido ou perdido e registra saldo ou reembolso explícito. Não existe crédito automático para o cliente.
- **RF-COM-11** **Venda direta** de acabado baixa o estoque, aceita cliente opcional, preço e desconto, pagamento ou recebível e emite recibo não fiscal.
- **RF-COM-12** Peça pronta com ajuste gera venda direta e OS separada, vinculadas como **atendimento vinculado**.
- **RF-COM-13** **Devolução de venda** documenta motivo, reembolso e destino (vendável, danificado ou perda); unidade vendável volta ao estoque com o **custo congelado** na venda.
- **RF-COM-14** Duas vendas offline da última unidade são preservadas e abrem **exceção de sobre-venda**, resolvida por reposição, produção, devolução ou cancelamento.

### 6.7 Documentos (RF-DOC)

- **RF-DOC-01** Tipos: orçamento formal A4, cupom de orçamento e recibo em 80 mm, comprovante de recepção, de entrega, de venda e de recebimento.
- **RF-DOC-02** Conforme o tipo, o documento traz identidade do ateliê, código, data, itens visíveis, descontos, totais, valores pagos e restantes e o aviso "documento não fiscal".
- **RF-DOC-03** Ao emitir, o sistema congela dados, template, PDF e hash. Nova informação exige revisão ou estorno ([ADR 0008](adr/0008-documentos-emitidos-imutaveis.md)).
- **RF-DOC-04** A PWA emite o PDF final offline com fontes e templates versionados, guarda o arquivo cifrado e sincroniza depois.
- **RF-DOC-05** Prévia, download, impressão pelo diálogo padrão do sistema e compartilhamento nativo são obrigatórios. O atalho de WhatsApp apenas preenche a mensagem; não há envio integrado nem impressão direta por driver.

### 6.8 Finanças e relatórios (RF-FIN)

- **RF-FIN-01** **Contas financeiras** configuráveis (dinheiro, banco, Pix e outras) com saldos próprios e transferências entre contas.
- **RF-FIN-02** **Recebíveis** de OS e venda aceitam entrada e parcelas livres por valor e vencimento, além de recebimento parcial.
- **RF-FIN-03** Um **pagamento** pode combinar meios e contas, gerar um único recibo e ser alocado a várias cobranças do mesmo cliente.
- **RF-FIN-04** **Excedente a reembolsar** fica visível para reembolso ou estorno e nunca é aplicado automaticamente a outra cobrança.
- **RF-FIN-05** Cartão liquida o valor bruto do cliente, registra a **taxa de recebimento** como despesa vinculada, credita o líquido na **conta de liquidação** e permite transferência posterior ao banco.
- **RF-FIN-06** Receitas e despesas avulsas são registradas com categorias.
- **RF-FIN-07** **Despesas diretas** opcionais ligadas a OS ou OP refinam a margem real; **despesas gerais** afetam só o resultado do ateliê, sem rateio na v1.
- **RF-FIN-08** Modelos de despesas recorrentes criam **obrigações recorrentes** projetadas, realizadas ao pagar.
- **RF-FIN-09** **Aporte e retirada do dono** alteram o saldo da conta, não o faturamento nem a despesa operacional.
- **RF-FIN-10** O caixa físico tem **conferência de caixa** diária opcional com diferença e motivo, sem impedir lançamentos retroativos.
- **RF-FIN-11** Relatórios distinguem **competência** e **caixa** e conciliam as duas visões.
- **RF-FIN-12** **Faturamento** reconhece a OS aprovada na data da aprovação; revisão aprovada reconhece só a diferença de valor na data da nova aprovação, nunca o total duas vezes. Venda direta entra pela data da venda; cancelamento e devolução reduzem o período do próprio evento.
- **RF-FIN-13** O custo de OS entra conforme consumo real e ajustes posteriores. OP capitaliza o acabado, e o custo vendido entra no resultado na venda. Compra de material não é despesa de resultado até o consumo ou a perda.
- **RF-FIN-14** Relatórios mostram margem estimada congelada na aprovação e margem real evolutiva e final, compras, estoque valorizado, vencimentos, contas, produção, serviços e produtos mais vendidos e motivos de perdas e ajustes.
- **RF-FIN-15** Relatórios são exportados ou impressos em PDF; não há CSV na v1.

### 6.9 Acesso, dispositivos e offline (RF-ACE)

- **RF-ACE-01** O **dono** entra com usuário e senha, sempre, no PC e no celular. Há limite de tentativas, atraso progressivo e bloqueio temporário.
- **RF-ACE-02** Não existe cadastro público: a conta única nasce no wizard local e nenhuma outra pode ser criada.
- **RF-ACE-03** **Códigos de recuperação** são de uso único. Perder todos permite **resgate físico**: verificação presencial por quem administra o sistema operacional do PC, que redefine só a conta e emite novos códigos, com auditoria e sem abrir cofres de dispositivos.
- **RF-ACE-04** Um aparelho novo só recebe o espelho completo depois de aprovado no **acesso local**, diretamente ou por código de ativação emitido nele. **Revogação** só limpa o aparelho quando ele se conectar.
- **RF-ACE-05** A sessão offline não expira pelo app. O **cofre offline** exige **senha do cofre** própria e forte; o **PIN local** bloqueia a tela após inatividade.
- **RF-ACE-06** A PWA usa apenas a **origem canônica** HTTPS do Tunnel; o celular não sincroniza pela rede local ([ADR 0001](adr/0001-origem-canonica-e-local-first.md)).
- **RF-ACE-07** Após ativação e sincronização inicial, todos os fluxos operacionais leem e gravam offline, inclusive câmera, códigos, PDF, fotos e pagamento.
- **RF-ACE-08** Tarefas que exigem o servidor (backup, restauração, Tunnel, atualização, aprovação de aparelho) mostram essa dependência claramente.
- **RF-ACE-09** A interface mostra conexão, último sync, operações pendentes, falhas e exceções.
- **RF-ACE-10** Edição feita sobre versão desatualizada vira **conflito protegido** na **caixa de conflitos**, com valores lado a lado, o impacto de cada escolha e as ações manter o local, manter o servidor, mesclar ou desfazer, sem parar o restante do sync.
- **RF-ACE-11** Aparelho que passou qualquer tempo sem sincronizar faz **rebase** completo sem apagar a outbox. Depois de atualização do app, o armazenamento local é migrado antes do sync; operações incompatíveis vão para **quarentena**.
- **RF-ACE-12** No iPhone, um assistente ensina "Adicionar à Tela de Início" e avisa que Safari e ícones duplicados guardam dados separados.
- **RF-ACE-13** A PWA pede armazenamento persistente, mostra uso e quota, avisa sobre fila longa ou pouco espaço e oferece a qualquer momento a **exportação da outbox** cifrada, importável numa nova instalação sem duplicar operações. O produto não promete retenção absoluta pelo navegador.
- **RF-ACE-14** Fotos são otimizadas no aparelho ao capturar (WebP, ou JPEG onde o navegador não gera WebP), com miniaturas. O dono pode baixar o arquivo otimizado preservado. Todas as miniaturas ficam disponíveis offline; imagens grandes já vistas ficam em cache.

### 6.10 Backup, instalação e atualização (RF-OPE)

- **RF-OPE-01** Backup diário às 02:00 na pasta escolhida pela interface (pasta local, disco externo ou pasta sincronizada), com execução compensatória quando o PC estava desligado.
- **RF-OPE-02** O **pacote de backup** contém banco consistente, imagens, PDFs e configurações não secretas. Exclui token do Tunnel e cofres móveis. Não é cifrado, e a interface avisa que a pasta guarda dados sensíveis.
- **RF-OPE-03** Retenção de 7 cópias diárias e 12 mensais. Falta de espaço gera alerta persistente e nunca apaga cópia existente.
- **RF-OPE-04** Restauração é feita só no acesso local: valida hash, manifesto e versão, pede código de recuperação, cria **pré-backup** e inicia novo epoch de sincronização.
- **RF-OPE-05** Windows usa instalador amigável por máquina, com servidor ativo sem login. Ubuntu 24.04 LTS usa pacote com serviço `systemd`.
- **RF-OPE-06** O assistente do Tunnel orienta a configuração no painel da Cloudflare, recebe apenas o token do tunnel remotamente gerenciado, testa e mostra o status. Não pede token da conta; o token fica mascarado e fora de backup e logs.
- **RF-OPE-07** Atualização assinada do GitHub Releases é baixada e aplicada em janela ociosa após pré-backup, pausando escritas e revertendo binários e banco juntos se a checagem de saúde falhar ([ADR 0005](adr/0005-atualizacao-coordenada.md)).
- **RF-OPE-08** Uma tela de diagnóstico mostra última cópia válida, histórico de backups, espaço, versão, sync, dispositivos, Tunnel e erros recuperáveis. Disco cheio, pasta ausente, banco inconsistente, Tunnel offline e serviço parado geram aviso persistente no app.

## 7. Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF-01 | Interface e documentos em português do Brasil; moeda BRL; fuso America/Recife editável |
| RNF-02 | Plataformas validadas: Windows (principal), Ubuntu 24.04 LTS, Chrome Android e Safari iPhone |
| RNF-03 | Layout usável de 320 px de largura até desktop, sem rolagem horizontal obrigatória |
| RNF-04 | Acessibilidade: toque e teclado em todas as ações, foco visível, contraste WCAG AA, nada dependente de hover |
| RNF-05 | Metas de desempenho, verificadas no aceite (CA-12): servidor local pronto em até 5 s após iniciar; tela já cacheada percebida em até 500 ms; fila offline normal sincronizada em até 10 s após reconectar |
| RNF-06 | Durabilidade: nenhuma operação confirmada é perdida ou aplicada duas vezes; histórico de negócio preservado indefinidamente |
| RNF-07 | Segurança: servidor escuta só em loopback; cookies `HttpOnly` e `Secure` na origem pública; proteção de origem e CSRF; segredos fora do repositório, de backups e de logs |
| RNF-08 | Privacidade: logs sem senhas, tokens, medidas, fotos ou dados completos de cliente; sem telemetria externa por padrão |
| RNF-09 | Identidade visual "ateliê contemporâneo": base clara em creme, verde-escuro como cor principal com lima no destino ativo, terracota e ocre nos estados de perigo e atenção, tipografia editorial (Source Serif 4) só em títulos, Geist na interface e JetBrains Mono em códigos, tema claro único e componentes objetivos para o uso diário. Tokens e componentes no [design system](areas/design-system.md) |
| RNF-10 | Instalar, fazer backup, restaurar e atualizar sem terminal |
| RNF-11 | Portabilidade: nenhuma regra depende de API exclusiva de um sistema operacional fora da camada de instalação e serviço |

## 8. Critérios de aceitação da v1

| ID | Critério |
|---|---|
| CA-01 | Criar conta e backup no wizard, sair, retomar o checklist e repetir a sandbox sem modificar relatórios reais |
| CA-02 | Cadastrar cliente pagador, perfil, medidas, peça recebida, fotos e comprovante; alterar medidas depois e confirmar que a OS aprovada manteve o snapshot |
| CA-03 | Criar material com variantes, local, lote e compra em embalagem; verificar conversão, custo de aquisição com frete e desconto, reserva, falta e lista de compras consolidada |
| CA-04 | Aprovar orçamento parcial e revisado, produzir e entregar um de vários subitens, registrar consumo e cobrança e fechar a OS somente quando produção, entrega e financeiro estiverem resolvidos |
| CA-05 | Produzir OP com saída parcial e perda, vender variante pronta, devolver unidade vendável e conferir custo médio e congelado, caixa e competência sem dupla contagem |
| CA-06 | Emitir A4 e 80 mm offline, editar identidade e preço depois e confirmar PDF antigo idêntico com hash preservado; imprimir e compartilhar sem integração automática |
| CA-07 | Fazer duas vendas e dois pagamentos offline concorrentes, sincronizar em ordem inversa e ver os fatos preservados e as exceções resolvíveis; edição protegida desatualizada vira conflito |
| CA-08 | Exportar a outbox, perder o IndexedDB, importar numa nova instalação e sincronizar sem duplicar; operações de epoch antigo entram em quarentena |
| CA-09 | Restaurar pacote completo e simular falha de atualização; dados, arquivos e serviços voltam a um estado consistente sem perder operação confirmada |
| CA-10 | Executar as jornadas por toque em Chrome Android e Safari iPhone e por desktop em Windows e Ubuntu 24.04, com uso local sem internet e avisos honestos sobre os limites da PWA |
| CA-11 | Reiniciar o PC Windows e ver servidor e Tunnel voltarem sem comando manual |
| CA-12 | Medir as metas do RNF-05 no PC do ateliê e num celular de referência |

## 9. Registro de decisões

Decisões tomadas com o dono. "Mão única" indica decisão cara de reverter; as principais têm ADR. As datas são de 2026-09-15 salvo indicação.

### 9.1 Produto e escopo

| ID | Decisão | Alternativas descartadas | Tipo | Referência |
|---|---|---|---|---|
| DEC-01 | Um dono, um ateliê, sem SaaS nem fiscal; login obrigatório inclusive no PC (2026-09-14) | Dono e funcionários; acesso de clientes; login só remoto | Mão única | §3 |
| DEC-02 | v1 completa entregue em fases internas | MVP menor com o resto na v2; um único ciclo sem checkpoints | Dupla | [ROADMAP](ROADMAP.md) |
| DEC-03 | Fluxo central completo: cliente, orçamento, aprovação, OS, produção, entrega e pagamento (2026-09-14) | Só orçamento e estoque; produção detalhada (agenda, provas, medidas, etapas e histórico) desde a primeira versão | Dupla | §6.6 |
| DEC-04 | Sem CSV na v1; cadastro do zero com saldos de abertura auditados | Importar e exportar CSV; apenas exportar | Dupla | RF-EST-14 |
| DEC-05 | Wizard guiado e retomável; obrigatórios identidade, conta, códigos e backup testado; sandbox descartável | Tudo obrigatório; checklist solto; dados de exemplo na base real | Dupla | RF-ENT-02 a 04 |
| DEC-06 | Tela inicial centrada na operação de hoje | Visão financeira; visão equilibrada | Dupla | RF-ENT-09 |
| DEC-07 | Direção visual "ateliê contemporâneo" (2026-09-14), com a paleta verde-escuro e creme do Claude Design (2026-09-16) | Profissional minimalista; boutique artesanal; destaques em vinho e terracota | Dupla | RNF-09 |
| DEC-08 | Termo "faturamento" para OS aprovada e venda direta | "Vendas e recebimentos"; faturamento igual a recebimento | Dupla | RF-FIN-12 |
| DEC-67 | Navegação principal com os destinos de uso diário soltos (Hoje, Agenda, Atendimento, Orçamentos, OS, Produção e Vendas) e os demais nos grupos "Catálogo e estoque" e "Gestão"; abaixo de 1280 px Produção e os grupos vão para "Mais", e no celular a barra inferior tem Hoje, Agenda, OS, Vendas e "Mais" (2026-09-16) | Menu lateral; 13 destinos soltos com "Mais" sem categoria; tudo por categoria, com OS e Vendas a dois cliques | Dupla | RF-ENT-05, RF-ENT-06, [design system](areas/design-system.md#navegação) |
| DEC-69 | Wizard inicial numa tela focada `/configuracao-inicial`, sem navegação, com o passo derivado do estado do servidor e retomado em qualquer recarga; barra verde com o nome do ateliê como prévia; no desktop, cartão do passo e checklist dos 5 passos ao lado, e no celular a trilha de etapas; códigos de recuperação guardados por "Baixar arquivo" e "Copiar", com caixa de confirmação liberando o avanço; login automático logo depois de criar a conta (2026-09-16) | Wizard em Configurações dentro do shell; uma rota por passo; tela cheia sem checklist; avançar sem caixa; redigitar um código | Dupla | RF-ENT-02, RF-ACE-03 |
| DEC-70 | Shell com destino sem tela aberto num estado vazio dentro da navegação, faixa de sub-abas só com o estado da conexão até existir a primeira seção com abas, sem busca até a busca global existir, e checklist de continuidade num painel em Hoje com os itens pendentes até cada tela existir (2026-09-16) | Página não encontrada; esconder destinos sem tela; sub-abas do desenho como âncoras; checklist na tela final do wizard; adiar o checklist | Dupla | RF-ENT-03, 05, 06 |

### 9.2 Atendimento e agenda

| ID | Decisão | Alternativas descartadas | Tipo | Referência |
|---|---|---|---|---|
| DEC-09 | Cliente pessoa ou organização, com perfis de usuário da peça; sem portal de cliente | Só pessoa; cada usuário da peça como cliente; link público; portal com login | Mão única | RF-ATD-01, 02 |
| DEC-10 | Modelos de medidas personalizáveis e snapshot aprovado na OS | Campos livres; modelos fixos; OS sempre com a medida mais nova | Mão única | RF-ATD-03, 04 |
| DEC-11 | Peça recebida com descrição obrigatória, fotos opcionais, comprovante e etiqueta com QR autenticado | Só observação na OS; fotos obrigatórias; código de barras dedicado | Dupla | RF-ATD-07, 08 |
| DEC-12 | Agenda com visitas, provas, prazos e capacidade diária em minutos; conflito permitido com alerta; alertas no app e, no PC, notificação do sistema com a interface aberta (ajustado pela DEC-59); mensagem preparada | Só prazos; blocos por horário; bloquear conflito; Web Push; envio integrado | Dupla | RF-ATD-09 a 12 |
| DEC-13 | Cliente é arquivado ou anonimizado; histórico de negócio mantido indefinidamente | Exclusão em cascata; retenção de 1 ou 5 anos | Mão única | RF-ATD-06, RNF-06 |
| DEC-72 | Cliente pagador com campos fixos: tipo (pessoa ou organização), nome obrigatório, telefone, outro telefone, e-mail, endereço numa linha e notas; telefone brasileiro com DDD guardado só com dígitos e buscável sem máscara e sem acento (2026-09-17) | Lista de contatos com rótulo; endereço estruturado com CEP; telefone internacional | Mão única | RF-ATD-01, [SPEC §2](SPEC.md#2-persistência-valores-e-fronteiras-de-domínio) |
| DEC-73 | Cliente e perfil arquiváveis e desarquiváveis a qualquer momento; arquivado sai da lista e dos seletores e continua legível e editável (2026-09-17) | Só cliente; arquivamento sem volta | Dupla | RF-ATD-06 |
| DEC-74 | Perfil de usuário da peça com nome e notas; o novo cliente oferece "Criar perfil com o mesmo nome", marcado em pessoa e desmarcado em organização, em duas operações do mesmo envio (2026-09-17) | Perfil com nascimento ou relação com o pagador; perfil sempre criado para pessoa; nunca criado | Dupla | RF-ATD-02 |
| DEC-75 | Anonimização só no acesso local, sem comando de sync, que redige o histórico de sincronização (snapshots, conflitos, resoluções e hash de operação, inclusive de operação que chega depois), limpa os bytes do arquivo com `secure_delete` e checkpoint do WAL e deixa o cliente e os perfis só leitura; enquanto OS e recebível não existem, nada a bloqueia (2026-09-17) | `change_log` sem dados; limpar só a linha viva; anonimizar em qualquer acesso ou pelo sync | Mão única | RF-ATD-06, RNF-08, [ADR 0014](adr/0014-anonimizacao-redige-historico-de-sincronizacao.md) |
| DEC-77 | Medida guardada como inteiro de milímetros, digitada e exibida em centímetros com até uma casa, de 0,1 a 999,9 cm (2026-09-17) | Meio centímetro inteiro; milionésimos de centímetro como a quantidade; décimos de milímetro | Mão única | RF-ATD-03, [ADR 0015](adr/0015-medidas-em-milimetros-e-medicao-autocontida.md) |
| DEC-78 | Modelos iniciais por tipo de peça: Vestido (16 campos), Saia (4), Calça (9), Blusa e camisa (12) e Blazer e paletó (11), criados pelo servidor no boot uma única vez, quando não existe nenhum modelo (2026-09-17) | Modelos por corpo (feminino, masculino, infantil); corpo inteiro e ajuste; criação pelo checklist de continuidade | Dupla | RF-ATD-03, Q-02 |
| DEC-79 | Medição datada, corrigível e arquivável, registrada a cada prova já preenchida com a última do mesmo modelo, e autocontida: copia nome, versão e rótulos do modelo e é composta pelo aparelho (2026-09-17) | Medição imutável; medidas atuais do perfil com histórico por versão; servidor copiando os rótulos do modelo atual; tabela de versões do modelo | Mão única | RF-ATD-02, 03, 04, [ADR 0015](adr/0015-medidas-em-milimetros-e-medicao-autocontida.md) |
| DEC-80 | Editor de modelo que grava todas as mudanças como uma versão ao salvar, com campos movidos por botão (toque e teclado) e nunca apagados, só desativados (2026-09-17) | Cada ação grava na hora; arrastar para ordenar; apagar campo | Dupla | RF-ATD-03 |
| DEC-81 | Ficha do cliente com perfis e medidas lado a lado a partir de 768 px, perfil escolhido na URL e medidas abaixo da lista no celular; registrar, corrigir e histórico em páginas próprias; modelos de medidas na sub-aba do Catálogo (2026-09-17) | Página própria do perfil; formulário de medidas em diálogo | Dupla | RF-ATD-02, 03, RF-ENT-06 |
| DEC-83 | Peça recebida é filha do cliente pagador, sem perfil; quem veste a peça entra no subitem da OS (2026-09-17) | Cliente com perfil opcional; filha do perfil de usuário da peça | Mão única | RF-ATD-07 |
| DEC-84 | Estado da peça recebida obrigatório entre Bom, Com avaria e Desgastada, com o detalhe nas observações opcionais (2026-09-17) | Detalhe obrigatório para avaria e desgaste; estado em texto livre | Mão única | RF-ATD-07 |
| DEC-85 | Peça recebida pode ser corrigida, arquivada e devolvida com data (devolução que pode ser desfeita) por uma única edição com versão-base; devolução prevista opcional; o código de custódia chega com a etiqueta (2026-09-17) | Devolução só com a entrega da OS; comandos próprios de devolução; código de custódia antes da etiqueta | Dupla | RF-ATD-07, 08 |
| DEC-86 | O "responsável" da recepção é sempre o dono único, sem campo; a operação guarda o momento e, quando chega pelo sync, o aparelho (2026-09-17) | Texto "Entregue por"; aparelho gravado na peça | Dupla | RF-ATD-07, DEC-01 |
| DEC-87 | Quantidade da peça recebida é contagem inteira de 1 a 999, fora de estoque e faturamento (2026-09-17) | Milionésimos da unidade base como o estoque | Mão única | RF-ATD-07, [ADR 0016](adr/0016-midia-enderecada-por-conteudo.md) |
| DEC-88 | Até 12 fotos de condição por peça, cada uma com legenda opcional de até 40 caracteres, adicionadas e removidas depois da recepção; foto sem referência sai do disco (2026-09-17) | 6 ou 24 fotos; sem legenda; fotos fixas na recepção; só adicionar | Dupla | RF-ATD-05, RF-ACE-14 |
| DEC-89 | Peças recebidas na ficha do cliente: painel "Peças em custódia" na terceira coluna a partir de 1280 px e logo depois do cabeçalho abaixo disso, com páginas próprias para receber, ver e corrigir; no celular, botões Câmera e Galeria, e no PC "Escolher fotos", aceitando só JPEG, PNG e WebP (2026-09-17) | Sub-aba geral de custódia; abas Medidas e Peças no celular; só câmera; aceitar qualquer imagem | Dupla | RF-ATD-05, 07, RF-ENT-06 |

### 9.3 Catálogo, estoque e produção

| ID | Decisão | Alternativas descartadas | Tipo | Referência |
|---|---|---|---|---|
| DEC-14 | Serviço com custo interno fixo e preço padrão separados, sem custo por hora; custo não inclui materiais da ficha | Horas estimadas e reais; só preço; serviço com materiais embutidos | Mão única | RF-CAT-01 |
| DEC-15 | Produto base com ficha técnica de materiais e serviços; variantes com saldo; kit como produto; variante ajusta só diferenças; perda fixa ou percentual | Tudo como produto genérico; produto separado por variante; kit que baixa componentes | Mão única | RF-CAT-06 a 09 |
| DEC-16 | Margem sobre a venda; sugestão nunca altera o preço; abaixo da meta ou do custo só com confirmação | Markup; atualização automática; bloquear abaixo do custo | Dupla | RF-CAT-11 a 13 |
| DEC-17 | Galeria no produto base com capa por variante; fotos otimizadas; miniaturas e imagens vistas offline | Uma imagem; galeria por variante; original sem otimizar; galeria completa em cada aparelho | Dupla | RF-CAT-06, RF-ACE-14 |
| DEC-18 | Desconto por linha ou total; visibilidade de preço por linha; custos internos ocultos | Só desconto no total; sempre detalhado; só totais | Dupla | RF-CAT-14, RF-COM-02 |
| DEC-19 | Material base com variantes, unidade base configurável, conversão de compra, locais com saldo, lote opcional, mínimo e alvo. Substituiu a escolha inicial de item independente por variação | Item independente por variação; saldo único; lote obrigatório; só metros e unidades | Mão única | RF-CAT-04, 05, RF-EST-01 a 04 |
| DEC-20 | Aprovação reserva sem baixar; falta vira pendência; lote escolhido só no consumo com sugestão do mais antigo. Substituiu a escolha inicial de baixar na aprovação | Baixar na aprovação; reserva negativa; bloquear aprovação; FIFO automático sem escolha | Mão única | RF-EST-07, 08, 10 |
| DEC-21 | Compras simples com fornecedor; frete e desconto rateados no custo; pagamento ou obrigação única; lista de compras consolidada sem pedido formal | Compras completas com contas a pagar; frete como despesa; só alertas de falta | Dupla | RF-EST-03 a 05, 09 |
| DEC-22 | Saldo negativo permitido com custo provisório e ajuste posterior, em OS e OP | Bloquear; congelar custo; custo zero | Mão única | [ADR 0003](adr/0003-movimentos-imutaveis-e-custo-provisorio.md) |
| DEC-23 | Reconciliação obrigatória antes de concluir; troca de material rastreada; insumo não controlado | Reconciliação opcional; consumo sempre igual ao planejado; cadastrar todo retalho | Dupla | RF-EST-11, 12, RF-CAT-10 |
| DEC-24 | Inventário por sessão e por ajuste rápido | Só sessão; só ajuste por item | Dupla | RF-EST-13 |
| DEC-25 | Fluxo de produção comum a OS e OP, com etapas iniciais ajustáveis (renomear, reordenar, ocultar, adicionar), versão atribuída na criação do trabalho com migração manual opcional e etapas aplicáveis sugeridas e ajustáveis; quadro por etapa e agenda | Etapas fixas; fluxos separados; fluxo por produto; atualizar todos os trabalhos; impedir alteração com OS aberta; lista por status | Dupla | RF-PRO-01 a 03 |
| DEC-26 | OP separada; custo rateado pelas unidades boas; saídas parciais com custo provisório; custo médio por variante congelado na venda e reconhecido na venda | Ajuste manual de estoque; OS interna; FIFO por lote acabado; custo reconhecido ao produzir | Mão única | [ADR 0002](adr/0002-os-op-e-venda-direta.md), RF-PRO-04 a 08 |

### 9.4 Comercial e documentos

| ID | Decisão | Alternativas descartadas | Tipo | Referência |
|---|---|---|---|---|
| DEC-27 | Orçamento aprovado vira OS; não existe entidade "pedido"; venda direta separada | Pedido e OS; pedido com estados de produção; OS para tudo | Mão única | [ADR 0002](adr/0002-os-op-e-venda-direta.md) |
| DEC-28 | OS agregadora com subitens; produção e entrega por subitem; estados separados de produção, entrega e financeiro | Uma OS por item; status único; entrega encerra a OS | Mão única | RF-COM-06, 07 |
| DEC-29 | Aprovação por registro manual | Exigir sinal; exigir assinatura | Dupla | RF-COM-05 |
| DEC-30 | Revisão comercial exige nova aprovação; orçamento vencido renova por revisão; aceite parcial por revisão; revisão lança só diferenças | Editar a OS diretamente; aprovar vencido com alerta; aprovação por item | Mão única | RF-COM-04, 08 |
| DEC-31 | Cancelamento com liquidação e reembolso explícito, sem crédito do cliente | Cálculo proporcional pelas etapas; crédito para futura OS; cancelar tudo | Dupla | RF-COM-10 |
| DEC-32 | Venda direta com cliente opcional; venda mais OS vinculada para ajuste; devolução com destino e custo congelado | Exigir cliente; tudo na OS; devolução sempre ao estoque | Dupla | RF-COM-11 a 13 |
| DEC-33 | Código documental não sequencial por dispositivo | Número provisório trocado no sync; blocos reservados | Mão única | [ADR 0009](adr/0009-uuid-e-codigo-documental-por-dispositivo.md) |
| DEC-34 | Documento congelado com dados, PDF e hash, emitido também offline; 80 mm e A4; diálogo padrão de impressão; compartilhamento manual | Regenerar PDF com template atual; 58 mm; impressão direta; envio integrado; emitir só no servidor | Mão única | [ADR 0008](adr/0008-documentos-emitidos-imutaveis.md) |

### 9.5 Finanças

| ID | Decisão | Alternativas descartadas | Tipo | Referência |
|---|---|---|---|---|
| DEC-35 | Caixa completo com várias contas, competência e caixa, parcelas livres, pagamento com alocação e divisão entre meios | Só recebimentos da OS; caixa único; saldo único por cobrança | Mão única | RF-FIN-01 a 03, 11 |
| DEC-36 | Cartão como bruto, taxa e líquido com conta de liquidação | Só líquido; banco imediato | Dupla | RF-FIN-05 |
| DEC-37 | Despesas diretas vinculáveis; gerais sem rateio; recorrentes como obrigações; aporte e retirada próprios; conferência de caixa opcional | Ratear despesas gerais; recorrência fora da v1; fechamento diário obrigatório | Dupla | RF-FIN-07 a 10 |
| DEC-38 | Compra eleva estoque; custo de OS pelo consumo real; faturamento pela aprovação e pela venda; pagamentos offline excedentes viram excedente a reembolsar | Compra como despesa imediata; custo na aprovação ou na entrega; quarentena do excedente | Mão única | RF-FIN-04, 12, 13 |

### 9.6 Plataforma, acesso e operação

| ID | Decisão | Alternativas descartadas | Tipo | Referência |
|---|---|---|---|---|
| DEC-39 | Serviço local, PWA e Tauri; servidor e `cloudflared` como serviços do sistema; instalação por máquina. Substituída pela DEC-59 (2026-09-16) | Só serviço web; desktop-first; Docker Desktop; Tauri na bandeja; instalação por usuário | Mão única | [ADR 0007](adr/0007-servico-do-so-e-tauri-administrativo.md) |
| DEC-40 | SQLite nativo do Bun em WAL como fonte autoritativa | libSQL do scaffold; `node:sqlite` | Mão única | [ADR 0006](adr/0006-sqlite-nativo-bun.md) |
| DEC-41 | PWA com operação offline completa, fila idempotente, conflito protegido para edição desatualizada e exceção para fatos concorrentes, sem limite de tempo offline. Substituiu "última alteração vence" | Somente leitura offline; última alteração vence; servidor vence; limite de 30 ou 90 dias | Mão única | [ADR 0003](adr/0003-movimentos-imutaveis-e-custo-provisorio.md), [ADR 0004](adr/0004-backup-epoch-e-cofre-por-dispositivo.md) |
| DEC-42 | Origem canônica no subdomínio do Tunnel; sem sync pela LAN. Substituiu a escolha inicial de LAN principal, inviável sem HTTPS e sem acesso ao roteador | LAN principal; DNS local com o mesmo subdomínio; duas origens | Mão única | [ADR 0001](adr/0001-origem-canonica-e-local-first.md) |
| DEC-43 | Login do app com defesas contra força bruta, sem Cloudflare Access; cofre com senha forte e PIN de tela; aparelho aprovado no acesso local ou por código de ativação; sessão offline sem expiração; códigos de recuperação e resgate físico com novos códigos. Substituiu a sessão lembrada sem bloqueio e o cache cifrado só por PIN | Cloudflare Access; restrição por país; PIN como chave; senha de login no cofre; validade de 7 ou 30 dias; recuperação por e-mail | Mão única | RF-ACE-01 a 05 |
| DEC-44 | Retenção móvel em melhor esforço com exportação cifrada portátil; instância instalada é a principal no iPhone | App nativo; sync periódico obrigatório; exportação só no mesmo perfil | Dupla | RF-ACE-12, 13 |
| DEC-45 | Backup diário às 02:00, pacote completo sem criptografia, 7 diários e 12 mensais, nunca apagar por falta de espaço; restauração com pré-backup, código de recuperação e novo epoch. Substituiu a retenção inicial de só 7 diários | 30 diários e 12 mensais; só 7 diários; cifrar com senha; apagar os mais antigos; restaurar em paralelo | Mão única | [ADR 0004](adr/0004-backup-epoch-e-cofre-por-dispositivo.md), RF-OPE-01 a 04 |
| DEC-46 | Tunnel remotamente gerenciado configurado por assistente com token de execução | Token de API da conta; configuração externa; só documentação | Dupla | RF-OPE-06 |
| DEC-47 | Atualização assinada no GitHub Releases público, baixada e aplicada em janela ociosa com rollback coordenado; sem certificado comercial inicial | Releases privados; servidor próprio; rollback só de binários; atualização manual | Mão única | [ADR 0005](adr/0005-atualizacao-coordenada.md) |
| DEC-48 | Ubuntu 24.04 LTS com pacote e `systemd`; Android e iPhone como alvos formais | Execução técnica em Linux; Ubuntu 26.04; só Android | Dupla | RNF-02 |
| DEC-59 | Sem app desktop: servidor e `cloudflared` como serviços do sistema, e o PC usa a interface no navegador pela origem local `http://127.0.0.1:<porta>` (porta fixada no S5 e nunca alterada), com atalho do Edge em modo app no Windows e de Chrome ou Chromium no Ubuntu; ações administrativas só no acesso local; pasta de backup escolhida num navegador de pastas do servidor; notificação no PC só com a interface aberta; supervisor como único canal de atualização, com assinatura minisign; NSSM descartado, wrapper e conta do serviço decididos no S5. Substituiu a DEC-39 (2026-09-16) | Manter Tauri; Electron; NSSM; PWA instalada por política do Edge; seletor de pasta nativo; processo na bandeja; `localhost` como origem local | Mão única | [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md) |
| DEC-60 | Dono criado só pelo comando local `installation.createOwner`, com compare-and-set do passo do wizard e `signUpEmail` no servidor; nenhuma rota HTTP de cadastro, porque o Hono repassa ao Better Auth só uma allowlist de rotas; hook de banco recusa segundo usuário; login por username (3 a 30 caracteres) e senha de 10 a 128 (2026-09-16) | Cadastro HTTP com hook `before`; `disabledPaths`; senha mínima de 8 ou 12 | Mão única | [ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md) |
| DEC-61 | Rate limit do Better Auth persistido no banco, 5 tentativas por 60 s em `/sign-in/username` por IP de `cf-connecting-ip`, mais bloqueio remoto global: a cada 5 falhas remotas seguidas, 1 min dobrando até 30 min, zerado no sucesso remoto; falha local nunca conta e o acesso local nunca é bloqueado (2026-09-16) | Só rate limit por IP; bloqueio por username digitado; atraso na resposta | Dupla | [ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md) |
| DEC-62 | 10 códigos de recuperação de 16 caracteres Crockford (80 bits), mostrados uma vez e guardados só como SHA-256; jogo novo invalida o anterior; redefinir senha com código só no acesso local, derrubando as sessões; auditoria em tabela append-only sem senha, código, segredo ou username tentado (2026-09-16) | Códigos curtos com scrypt; HMAC com o segredo do servidor; reset pelo Tunnel; auditoria só no evlog | Mão única | [ADR 0012](adr/0012-dono-unico-criado-no-acesso-local.md) |
| DEC-63 | Contrato mínimo de sync em procedures oRPC; dispositivo com segredo de 256 bits em hash e aprovação no acesso local, direta ou por código de ativação de 8 caracteres válido por 10 min e guardado em HMAC-SHA-256; toda operação gravada por `opId` na transação do efeito, com hash do conteúdo, `opIdReused` em quarentena e item malformado em quarentena sem barrar o lote; epoch UUIDv4 verificado antes da versão-base; pull por cursor com `rebase` e `hasMore`; `resolve` com `keepLocal`, `keepServer` e `merge` e motivo (2026-09-16) | Rotas `/api/sync/*`; dispositivo só por `deviceId` ou por sessão; `opId` repetido sempre devolve o gravado; erro de epoch no pull; epoch contador | Mão única | [ADR 0013](adr/0013-contrato-minimo-de-sincronizacao.md) |
| DEC-64 | Parte de servidor do wizard entregue antes das telas: estados, navegador de pastas alimentado pelo servidor e teste de gravação da pasta de backup (2026-09-16) | Só o estado; tudo junto com a tela | Dupla | [SPEC §5](SPEC.md#5-segurança-e-armazenamento-local) |
| DEC-71 | `installation.status` devolve o acesso (`local` ou `remote`) e o estado a qualquer um; nome do ateliê, pasta de backup testada e versão saem só pela `installation.details`, no acesso local e sem sessão apenas antes da conta; o navegador de pastas escolhe pasta existente ou caminho digitado, sem criar pasta no servidor (2026-09-16) | Tudo no `status` com nulo sem permissão; tudo público; comando para criar pasta | Dupla | [SPEC §5](SPEC.md#5-segurança-e-armazenamento-local) |
| DEC-76 | Cada comando de agregado é definido uma vez (payload, carga e aplicação), registrado no `sync.push` como criação ou edição e exposto como procedure oRPC tipada que grava a operação com o agregado; versão-base velha responde `CONFLICT` na procedure e abre conflito no push, e o conflito continua por versão do agregado inteiro (2026-09-17) | Web escrevendo pelo `sync.push`; só procedures diretas até o offline; conflito por campo | Mão única | [SPEC §4](SPEC.md#4-api-sincronização-e-conflito), [agregados](areas/agregados.md) |
| DEC-82 | Toda quarentena de comando de agregado com dado pessoal (cliente, perfil e medição), criação ou edição e por qualquer motivo, grava o hash da operação como `redacted`, com o comando procurado pelo nome; as pendências de sync não repetem como `opIdReused` a operação que já está em quarentena (2026-09-17) | Só criação; só medição; hash redigido só para pai inexistente | Dupla | RNF-08, [SPEC §4](SPEC.md#4-api-sincronização-e-conflito), [ADR 0014](adr/0014-anonimizacao-redige-historico-de-sincronizacao.md) |
| DEC-90 | Mídia endereçada por SHA-256, enviada por `PUT /api/media/<hash>` e lida por `GET`, gravada de forma atômica em `media` ao lado do banco, com a linha de `media_file` só depois do hash conferido; o agregado guarda os hashes no payload e o comando não confere o arquivo (2026-09-17) | Upload por procedure oRPC; foto como agregado próprio; comando que exige o arquivo com quarentena nova; variável `MEDIA_DIR` | Mão única | RF-ACE-14, [ADR 0016](adr/0016-midia-enderecada-por-conteudo.md) |
| DEC-91 | Foto otimizada no aparelho em WebP onde o navegador gera e JPEG onde não gera (Safari), com 2048 px no lado maior e qualidade 0,82, miniatura de 512 px e 0,80 no mesmo formato e até 4 MiB por arquivo (2026-09-17) | Só JPEG; guardar o original; 1600 px com miniatura de 400; 2560 px com 0,85 | Mão única | RF-ACE-14, Q-05 |
| DEC-92 | Arquivo de mídia sem referência sai por coleta no boot e de hora em hora, com carência de 24 h renovada a cada reenvio; na anonimização, a descrição da peça vira "Peça anonimizada", acessórios, observações, legendas e fotos saem, e os arquivos são removidos na hora, sem promessa de destruição física (2026-09-17) | Nunca apagar fora da anonimização; remover na hora ao tirar a foto; manter a descrição; sobrescrever com zeros | Mão única | RF-ATD-06, RNF-08, [ADR 0016](adr/0016-midia-enderecada-por-conteudo.md) |

### 9.7 Engenharia e processo

| ID | Decisão | Alternativas descartadas | Tipo | Referência |
|---|---|---|---|---|
| DEC-49 | Monorepo gerado pelo Better-T-Stack 3.43.1: TanStack Router, Hono, Bun, SQLite com Drizzle, oRPC, Better Auth, pnpm e addons PWA, Tauri, Turborepo, Biome, Lefthook, Ultracite e evlog; o addon Tauri saiu em 2026-09-16 pela DEC-59 | Oxlint, Nx e Husky (sobrepõem Biome, Turborepo e Lefthook) | Mão única | [SPEC §1](SPEC.md#1-topologia-e-componentes) |
| DEC-50 | Jornadas de interface validadas em navegador real com browser-harness; sem Playwright | Suíte Playwright no CI | Dupla | [HARNESS](HARNESS.md) |
| DEC-51 | PRD, SPEC, ROADMAP, CONTEXT, ADRs, HARNESS e REFERENCIAS versionados; specs e planos de sessão locais (2026-09-16) | Specs e planos versionados; ADRs locais | Dupla | [HARNESS](HARNESS.md) |
| DEC-52 | Wireframes HTML descartados; a interface nasce de um design system com Claude Design (2026-09-16); o Storybook previsto saiu pela DEC-68 | Reimportar os wireframes do Linux | Dupla | [ROADMAP F1](ROADMAP.md#f1-design-system) |
| DEC-53 | Harness com Claude como padrão; portas de Codex e `.claude` geradas a partir de `.agents` e `.mcp.json`; MCPs context7 e shadcn; skills vendorizadas sem turborepo, vercel-react-best-practices e review-logging-patterns (2026-09-16) | Symlinks; cópias à mão; cinco MCPs; manter as 12 skills | Dupla | [HARNESS](HARNESS.md) |
| DEC-54 | Harness evolutivo: hooks de sessão no Claude (guard, format, stop-check), rules por área, skills de ciclo de entrega, índice de docs com `docs-check` no pre-commit e CI em Ubuntu 24.04 e Windows; merge local na `main` e push após confirmação, sem PR (2026-09-16) | Evolução manual do harness; hooks também no Codex agora; pull requests; CI só em Ubuntu | Dupla | [HARNESS §4](HARNESS.md#4-ciclo-de-entrega-e-evolução-do-harness) |
| DEC-55 | Repositório público `onflux-tech/costura-pro` com licença MIT e README bilíngue EN/PT no padrão do vsftpd-manager (2026-09-16) | Público sem licença; README só em português | Mão única | [LICENSE](../LICENSE) |
| DEC-56 | Mesma origem com processo único em loopback, porta 3000 até o S5, allowlist de Host e Origin e cookie `costura-pro.session_token` numa instância do Better Auth, sem `Secure` no loopback e com `Secure` acrescentado no Host canônico (2026-09-16) | Duas instâncias do Better Auth por Host; `baseURL` dinâmica com `crossSubDomainCookies`; nome padrão `better-auth`; porta própria já na F0 | Dupla | [SPEC §1](SPEC.md#1-topologia-e-componentes), [SPEC §5](SPEC.md#5-segurança-e-armazenamento-local) |
| DEC-57 | Código sem comentários: o porquê vai para armadilha do HARNESS, rule da área ou SPEC, e o guard do Claude barra comentário novo (2026-09-16) | Comentar o porquê no código; checagem também no pre-commit | Dupla | [HARNESS §5](HARNESS.md#5-hooks-do-claude-code) |
| DEC-58 | Integração automática ao fim de cada entrega: commits por área, merge `--ff-only` na `main`, push e CI acompanhado sem confirmação (2026-09-16). Substituiu o push após confirmação da DEC-54 | Push com confirmação a cada entrega; integração só a pedido do dono | Dupla | [HARNESS §4](HARNESS.md#4-ciclo-de-entrega-e-evolução-do-harness) |
| DEC-65 | Código, testes, migrations e mensagens de commit não citam fase, spike, spec, plano nem ID de requisito, decisão ou questão; nomes descrevem o conteúdo (2026-09-16) | Nomear arquivos e commits pela fase | Dupla | [AGENTS.md](../AGENTS.md) |
| DEC-66 | Design system em `packages/ui`: tokens em hexadecimal com contraste AA conferido por teste, tema claro único, fontes empacotadas por `@fontsource-variable` com precache só do subconjunto latino, shadcn `base-vega` sobre Base UI, e telas só com componentes, sem elemento ou diálogo nativo do navegador e sem emoji (2026-09-16) | Tema escuro; Google Fonts; componentes do zero; classes soltas nas telas | Dupla | [design system](areas/design-system.md) |
| DEC-68 | Catálogo de componentes em rota só de desenvolvimento no lugar do Storybook (2026-09-16) | Storybook 10 com addon de acessibilidade, cuja automação depende de Playwright (DEC-50) | Dupla | [design system](areas/design-system.md) |

## 10. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Navegador elimina o armazenamento da PWA | Perda de operações ainda não sincronizadas | Pedir persistência, mostrar quota, avisar fila longa, exportação cifrada da outbox (RF-ACE-13); spike S4 |
| PDF gerado no celular difere entre plataformas ou é lento | Documento emitido offline ilegível ou inconsistente | Templates e fontes versionados; spike S1 antes da F4 |
| Cofre cifrado lento em aparelho modesto | Uso offline travado | Parâmetros de derivação versionados por plataforma; spike S2 antes da F6 |
| Leitura de QR e código de barras falha no iPhone | Etiqueta e estoque por câmera inutilizáveis no iOS | Spike S3 antes da F3; código curto digitável sempre disponível |
| Sincronização (conflito, epoch, rebase) mais complexa que o previsto | Atraso em todas as fases | Contrato mínimo na F2; todo agregado nasce com versão e `opId`; testes com duas outboxes |
| Serviço e atualização coordenada falham no Windows (permissões, antivírus, SmartScreen) | Ateliê parado ou versão inconsistente | Spikes S5 e S6 antes da F7; pré-backup e rollback conjunto |
| Pasta de backup sincronizada recebe arquivo parcial | Backup inválido | Promover só após validação completa e troca atômica (SPEC §6) |
| Pacote de backup sem criptografia é exposto | Vazamento de dados de clientes | Aviso explícito na escolha da pasta; decisão consciente do dono (DEC-45) |
| Cópia de backup anterior a uma anonimização guarda os dados do cliente | Dado pessoal recuperável até a cópia sair da retenção | Redação completa no banco vivo e no histórico de sync; retenção limitada a 7 diárias e 12 mensais; decisão consciente do dono (DEC-75) |
| Foto HEIC escolhida no Chrome ou Edge do PC, ou foto de 48 MP no iPhone | Foto não abre ou a aba recarrega por falta de memória | Seletores aceitam só JPEG, PNG e WebP (o iPhone converte HEIC); mensagem clara quando não decodifica; nenhum canvas acima de 2048 px; conferir no aparelho (Q-10) |
| Foto apagada continua no cache do aparelho ou num backup antigo | Imagem de cliente anonimizado ainda visível fora do servidor | Cache HTTP privado só no aparelho do dono; retenção limitada dos backups; decisão consciente do dono (DEC-92) |
| Perda de senha e de todos os códigos | Dono trancado fora | Resgate físico auditado no PC (RF-ACE-03) |
| Tunnel exposto antes do cadastro fechado | Terceiro cria conta | Não expor o Tunnel até a F2 fechar o cadastro público |
| Porta local ocupada ou trocada depois da instalação | Servidor não sobe, ou a interface do PC perde sessão e cache | Porta definitiva fixada no S5, conferida pelo instalador e nunca alterada (DEC-59) |
| Ataque pelo Tunnel mantém o login remoto bloqueado | Dono não entra pelo celular enquanto durar o ataque | Bloqueio global com teto de 30 min, sessões abertas continuam valendo e o acesso local nunca é bloqueado (DEC-61) |
| Escopo grande para um único desenvolvedor assistido por IA | v1 nunca termina | Fases com critério de saída, TDD e harness de agentes |

## 11. Métricas de sucesso

- **Zero** operação confirmada perdida ou aplicada duas vezes em testes e no uso real.
- **Zero** divergência de estoque ou dinheiro causada por sincronização.
- Um backup válido por dia, com restauração testada a cada release.
- Metas do RNF-05 atendidas no PC do ateliê e num celular de referência.
- O dono conduz o ateliê sem planilha paralela depois da v1 (avaliação do próprio dono).

## 12. Questões em aberto

| ID | Questão | Quando decidir |
|---|---|---|
| Q-01 | Identidade final: nome comercial, logo, paleta exata e tipografia | Paleta e tipografia resolvidas em 2026-09-16 (DEC-07, DEC-66); nome comercial e logo antes do instalador da F7 |
| Q-02 | Etapas padrão do fluxo de produção, modelos iniciais de medidas e categorias iniciais de material e despesa | Modelos iniciais de medidas resolvidos em 2026-09-17 (DEC-78); etapas padrão antes do fluxo de produção da F4 e categorias iniciais antes do catálogo de materiais e das finanças |
| Q-03 | Biblioteca de PDF que funcione igual no navegador móvel e no desktop | Spike S1 |
| Q-04 | Leitura de QR e código de barras pela câmera no iPhone | Spike S3 |
| Q-05 | Parâmetros do cofre: derivação de chave por plataforma, limites de quota, dimensão e qualidade de foto | Dimensão e qualidade de foto resolvidas em 2026-09-17 (DEC-91); derivação e quota nos spikes S2 e S4 |
| Q-06 | Wrapper de serviço no Windows para o servidor Bun compilado (shawl ou WinSW 2.12 NET461; NSSM descartado pela DEC-59), conta do serviço e supervisor da atualização | Spikes S5 e S6 |
| Q-07 | Repositório remoto e CI | Resolvida em 2026-09-16: GitHub público `onflux-tech/costura-pro` com CI em Ubuntu 24.04 e Windows (DEC-54, DEC-55) |
| Q-08 | Nome definitivo do serviço e do atalho, guarda da chave minisign de atualização e adesão à SignPath Foundation para assinar os executáveis | F7 |
| Q-09 | Domínio e subdomínio do dono na Cloudflare | Antes de expor o Tunnel (fim da F2) |
| Q-10 | Aparelhos de validação: iPhone, Android e máquina Ubuntu 24.04 | Celulares antes do S3; Ubuntu antes da saída da F0 |
| Q-11 | App desktop no PC: manter Tauri, trocar por Electron, ou dispensar o app e usar serviço do Windows (NSSM ou WinSW) com instalador NSIS e a PWA aberta no loopback | Resolvida em 2026-09-16: sem app desktop; o PC usa o navegador pela origem local, servidor e `cloudflared` seguem como serviços, e wrapper e conta do serviço saem do S5 (DEC-59, [ADR 0011](adr/0011-servico-do-so-e-acesso-local-no-navegador.md)) |

## 13. Glossário

O vocabulário do domínio está em [CONTEXT.md](../CONTEXT.md). Termo novo ou com sentido alterado entra lá na mesma mudança que o introduz.

# Linguagem do Costura Pro

Glossário do único ateliê administrado por um único dono. Termos financeiros são gerenciais, nunca fiscais. Regras e contratos ficam no PRD e na SPEC; aqui só o significado de cada palavra.

## Atendimento

**Cliente pagador**:
Pessoa ou organização responsável pelo atendimento e pelos valores devidos.
_Evitar_: usuário da peça, conta

**Perfil de usuário da peça**:
Pessoa para quem uma peça é feita ou ajustada, vinculada a um cliente pagador. Pode não ter telefone nem obrigação de pagamento.
_Evitar_: cliente secundário

**Modelo de medidas**:
Conjunto versionado e personalizável de campos de medidas, em centímetros, para um tipo de peça. Cada salvamento gera uma versão; campo deixa de ser usado por desativação, nunca por exclusão.

**Medição**:
Registro datado das medidas de um perfil num modelo de medidas, com cópia do nome, da versão e dos rótulos do modelo. Pode ser corrigida e arquivada; cada prova ou visita gera uma medição nova.
_Evitar_: ficha de medidas, medida atual

**Snapshot de medidas**:
Cópia da medição atual de cada modelo do perfil (rótulos, valores, data e notas) congelada no subitem de OS na aprovação. Corrigir a medição ou o perfil depois não altera o snapshot; subitem sem perfil não tem snapshot.

**Peça recebida**:
Bem do cliente pagador sob custódia do ateliê para ajuste ou reparo, com estado na recepção (bom, com avaria ou desgastada), quantidade em unidades e data de devolução quando volta ao cliente. Não é estoque nem faturamento.
_Evitar_: produto em estoque

**Foto de condição**:
Foto de uma peça recebida, otimizada no aparelho, com miniatura e legenda opcional, que registra o estado em que a peça chegou.
_Evitar_: anexo

**Mídia**:
Arquivo de imagem guardado pelo servidor e identificado pelo SHA-256 do próprio conteúdo; o registro que usa a foto guarda só esse hash.
_Evitar_: upload, anexo

**Comprovante de recepção**:
Documento não fiscal que descreve as peças recebidas, seu estado e a data de entrada.

**Etiqueta de custódia**:
Código curto com QR que identifica uma peça recebida e abre sua rota interna autenticada.

**Compromisso**:
Visita, prova ou outro encontro com cliente, ligado ou não a uma OS.
_Evitar_: evento, reunião

**Capacidade diária**:
Minutos de trabalho que o ateliê consegue executar num dia, usados para avisar sobrecarga no dia e na semana.

**Mensagem preparada**:
Texto de lembrete ou retirada que o sistema monta e o dono revisa e envia manualmente.
_Evitar_: envio automático, notificação ao cliente

**Arquivamento**:
Retirada de um cadastro das telas do dia a dia sem apagar sua identidade nem seu histórico.

**Anonimização**:
Remoção irreversível dos dados pessoais de um cliente sem OS ou saldo aberto, de seus perfis, dos valores e notas das medições e da descrição, dos acessórios, das observações e das fotos das peças recebidas, inclusive das cópias guardadas no histórico de sincronização e dos arquivos de mídia, preservando o histórico financeiro sem identificá-lo.
_Evitar_: exclusão

## Catálogo e preço

**Serviço**:
Atividade de costura, feita no ateliê ou terceirizada, com custo e preço praticado separados. O custo não inclui materiais listados à parte. A versão sobe a cada edição, e o orçamento copia o serviço como estava.

**Etapas sugeridas**:
Etapas do fluxo de produção que um serviço costuma percorrer. Vêm marcadas no "Iniciar produção" do subitem, que une as dos serviços de uma peça; sem nenhuma, todas as etapas ativas vêm marcadas.

**Serviço terceirizado**:
Serviço executado fora do ateliê, marcado no cadastro, com custo estimado substituído pela despesa real quando ela é vinculada.

**Produto base**:
Definição comum de um produto acabado ou de um kit, com a galeria compartilhada e a ficha técnica.

**Variante de produto**:
Tamanho, cor ou apresentação vendável com código, preço, capa opcional, ajustes da ficha e saldo próprios.

**Kit**:
Produto cuja unidade vendável representa o conjunto inteiro. Componentes só têm saldo se forem cadastrados como produtos próprios.

**Ficha técnica**:
Composição planejada de um produto base: variantes de material com quantidade e perda normal, e serviços com quantidade. A variante do produto ajusta só o que difere.
_Evitar_: receita

**Item da ficha**:
Linha da ficha técnica: uma variante de material com a quantidade de uma peça na unidade dela e perda normal opcional, ou um serviço com quantidade inteira, cada um com observação curta opcional.

**Perda normal**:
Sobra planejada de um material na ficha técnica, fixa na unidade dele ou percentual sobre a quantidade.

**Quantidade planejada**:
Quantidade de um item da ficha somada à perda normal, arredondada para cima. É ela que entra no custo estimado e, depois, na reserva.

**Ajuste da variante**:
Diferença de uma variante de produto em relação à ficha do produto base: um item trocado, um item tirado ou um item acrescentado.

**Ficha efetiva**:
Ficha de uma variante de produto depois de aplicar os ajustes dela à ficha do produto base.

**Custo estimado**:
Soma dos custos da ficha efetiva, com os materiais pelo custo de referência e os serviços pelo custo atual. É calculado na hora, fica incompleto quando falta o custo de algum material e não existe quando a ficha efetiva está vazia.

**Galeria compartilhada**:
Até 12 imagens do produto base, a primeira como imagem principal, usadas por todas as variantes. A capa da variante é uma dessas imagens e substitui apenas a principal.

**Margem desejada**:
Meta de margem sobre o preço de venda usada para sugerir preço. A meta do ateliê vale para todo serviço e produto, e um serviço ou um produto base pode ter meta própria, que vence a do ateliê. Nunca bloqueia venda nem muda preço.
_Evitar_: markup

**Preço sugerido**:
Custo estimado dividido por um menos a margem desejada, arredondado para cima ao centavo. É calculado na hora e nunca gravado.

**Preço praticado**:
Preço confirmado pelo dono em catálogo, orçamento ou venda. A sugestão não o altera automaticamente.

**Margem estimada**:
Margem congelada na aprovação de um orçamento, a partir dos custos estimados naquele momento.

**Margem real**:
Margem que evolui com consumo, perdas, despesas diretas e ajustes de custo posteriores à aprovação.

## Trabalho e venda

**Orçamento**:
Proposta comercial para um cliente pagador, montada num rascunho sempre editável; cada emissão grava uma revisão congelada. O estado é derivado: rascunho, emitido, vencido ou recusado. Vencimento e aceite parcial exigem nova revisão.
_Evitar_: pedido

**Revisão do orçamento**:
Retrato numerado e congelado do orçamento na emissão ("rev. 2"), com as linhas, os totais, o custo, a meta de margem do momento, a data da emissão e o "válido até". Nunca muda; o rascunho segue editável e prepara a revisão seguinte.
_Evitar_: versão do orçamento

**Linha do orçamento**:
Item do orçamento: serviço do catálogo, peça sob medida, material do estoque ou linha livre, com quantidade, preço por unidade, desconto opcional e observação. Nomes, versões e custos são copiados quando a linha entra e não acompanham o catálogo.

**Peça sob medida**:
Linha do orçamento para uma peça a confeccionar, com descrição, quantidade de peças, preço por peça, perfil opcional e componentes, que podem vir da ficha técnica efetiva de um produto ou de uma variante.
_Evitar_: produto (o acabado com saldo)

**Componente da peça**:
Material ou serviço de uma peça sob medida, com a quantidade por peça e o custo unitário copiados e editáveis. Material sem custo deixa o custo do orçamento incompleto.

**Linha livre**:
Linha do orçamento sem cadastro, como taxa de urgência, entrega ou insumo não controlado, com descrição, preço e custo opcional; custo vazio deixa o custo do orçamento incompleto, e 0 é cobrança sem custo.

**Validade do orçamento**:
Dias corridos, 15 por padrão, que viram a data "válido até" na emissão. Passada a data, o orçamento está vencido e renova só com nova revisão.

**Prazo proposto**:
Dias corridos contados da aprovação para entregar o trabalho do orçamento; opcional, "a combinar" quando vazio.

**Prazo combinado**:
Data de entrega acertada na aprovação, sugerida pelo dia do aceite mais o prazo proposto e nunca anterior ao aceite; vazia fica "a combinar". Vale para todos os subitens da OS.

**Recusa do orçamento**:
Registro, pelo dono, da data e do motivo opcional em que o cliente recusou. Desfazível; emitir nova revisão reabre o orçamento.

**Materiais previstos**:
Soma, por variante de material, do que as linhas e as peças sob medida do orçamento vão usar, comparada com a disponibilidade atual. Mostra a falta, mas não reserva nada antes da aprovação.

**Aceite parcial**:
Revisão do orçamento que contém somente os itens que o cliente aceitou.

**Aprovação**:
Registro manual, pelo dono, do aceite do cliente sobre a última revisão emitida: data do aceite entre a emissão e o "válido até", canal e nota opcional. Não exige assinatura nem sinal; abre a OS na mesma operação e deixa o orçamento só leitura.

**Canal da aprovação**:
Por onde o cliente aceitou: Presencial, WhatsApp, Telefone, E-mail ou Outro.

**Código documental**:
Identificador humano permanente de um documento ou ordem, formado por tipo, ano, sigla do dispositivo e contador local, como `ORC-2026-CEL-0042`.
_Evitar_: número sequencial

**Ordem de Serviço (OS)**:
Trabalho sob medida ou reparo nascido da aprovação de um orçamento, com código `OS-<ano>-<sigla>-<número>`, subitens, produção, entrega e cobrança.
_Evitar_: pedido

**Subitem de trabalho**:
Peça ou serviço dentro da OS com medidas, materiais, etapas, prazo e entrega próprios. Nasce um por linha de serviço, peça sob medida ou material da revisão aprovada; o de material é só entrega, e a linha livre fica só no valor.

**Estado de produção**:
Posição de um subitem no fluxo de produção, independente de entrega e pagamento: A iniciar, numa etapa aplicável ou Pronto. "A iniciar" e "Pronto" ficam fixos nas pontas do fluxo; a peça com material planejado chega ao Pronto pela reconciliação, e volta a ele direto enquanto a reconciliação estiver ativa.

**Subitem atrasado**:
Subitem de produção ainda não pronto com o prazo combinado antes de hoje.

**Subitem bloqueado**:
Subitem de produção ainda não pronto com falta de algum material da linha. É só um aviso: não impede o avanço.

**Estado de entrega**:
Situação da entrega de um subitem ao cliente: pendente ou entregue.

**Estado financeiro**:
Situação da cobrança de uma OS ou venda: sem cobrança, a receber, parcialmente recebido, quitado ou com reembolso pendente.

**Encerramento da OS**:
Condição em que todos os subitens estão reconciliados e entregues, ou formalmente cancelados, e o estado financeiro está resolvido.

**Revisão comercial**:
Alteração de preço, material prometido ou prazo que só vale após nova aprovação.

**Revisão interna**:
Alteração de nota ou de etapa que não muda o acordo com o cliente e vale imediatamente.

**Fluxo de produção**:
Lista das etapas possíveis, comum a OS e OP, que o dono renomeia, reordena, oculta e amplia. Cada trabalho recebe uma cópia da versão vigente ao ser criado e só muda por migração manual ("Usar a versão nova").

**Versão do fluxo**:
Número que sobe a cada gravação do fluxo de produção. A OS mostra a versão com que nasceu e oferece a vigente quando é mais nova.

**Etapa**:
Passo do fluxo de produção, com nome e identidade estáveis entre versões. Etapa oculta sai das escolhas novas mas continua valendo para o trabalho que já a usa; nunca é apagada.

**Etapa aplicável**:
Etapa do fluxo selecionada para um subitem ao iniciar a produção, congelada na ordem do fluxo; as demais são puladas sem transição manual.

**Quadro por etapa**:
Visão da produção com uma coluna por etapa entre "A iniciar" e "Pronto" e um cartão por subitem, pelo prazo.

**Reconciliação de materiais**:
Confirmação, ao marcar pronta uma peça com material planejado, do que foi consumido e perdido de cada material, de que local e lote saiu e de qual material foi usado no lugar do previsto. O que sai do estoque sai nesse momento; o resto é sobra da reconciliação. Libera a reserva do subitem. Há no máximo uma ativa por subitem.
_Evitar_: baixa, fechamento de material

**Sobra da reconciliação**:
Parte do previsto de um material que não saiu do estoque na reconciliação. Nunca deixou o estoque, então não tem movimento: só deixa de estar reservada. Não confundir com a sobra da contagem de inventário.
_Evitar_: devolução, material retornado, sobra (sozinho)

**Estorno da reconciliação**:
Registro que desfaz uma reconciliação inteira: devolve ao estoque o que ela tirou, pelo mesmo valor, faz a reserva voltar a contar e tira a peça de Pronto. Material gasto a mais depois do Pronto se registra estornando e reconciliando de novo com o total.
_Evitar_: cancelar reconciliação, consumo complementar

**Entrega parcial**:
Entrega de um ou mais subitens de uma OS ainda aberta, com comprovante próprio.

**Liquidação de cancelamento**:
Acerto ao cancelar uma OS já executada em parte: o que é cobrado, o destino do material e o saldo ou reembolso explícito.
_Evitar_: acerto, estorno automático

**Ordem de Produção (OP)**:
Trabalho interno, sem cliente, que transforma materiais e serviços em produtos acabados para estoque.
_Evitar_: OS interna

**Unidade boa**:
Unidade produzida por uma OP e aceita no estoque de acabados.
_Evitar_: unidade aprovada

**Perda de produção**:
Material ou unidade que não se torna produto bom e cujo destino e custo são registrados. Na OS, é o perdido de cada material na reconciliação, que sai do estoque junto com o consumido.

**Saída parcial de OP**:
Entrada de unidades boas no estoque antes do fechamento da OP, com custo provisório.

**Venda direta**:
Venda de produto acabado disponível, sem orçamento nem OS, com cliente opcional.

**Atendimento vinculado**:
Venda direta e OS de ajuste da mesma peça, ligadas entre si com históricos separados.

**Devolução de venda**:
Retorno de produto vendido com motivo, reembolso quando devido e destino: vendável, danificado ou perda.

**Insumo não controlado**:
Material usado num trabalho sem movimento de estoque, como retalho antigo, digitado como linha livre do orçamento ou da OS, com custo estimado opcional. Não tem cadastro.
_Evitar_: material avulso

**Documento emitido**:
Documento não fiscal cujos dados, PDF e hash foram congelados na emissão. Mudança posterior exige revisão ou estorno.
_Evitar_: nota, cupom fiscal

## Estoque e custo

**Material base**:
Definição comum de tecido, linha, zíper, botão ou outro insumo.

**Variante de material**:
Cor, tamanho ou especificação com código, imagem, unidade base, precisão exibida, custo de referência, mínimo, alvo e saldo próprios. O código é livre e pode repetir; a unidade base não muda depois da criação.

**Unidade base**:
Unidade em que o saldo de um material é controlado, independentemente da embalagem de compra. Vem de uma lista fechada (metro, centímetro, metro quadrado, unidade, par, grama, quilograma, mililitro e litro), cada uma com abreviação e precisão sugerida.

**Precisão exibida**:
Número de casas decimais, de 0 a 6, com que a quantidade de uma variante aparece e pode ser digitada. É só exibição: o valor gravado continua em milionésimos.

**Categoria de material**:
Texto curto que agrupa materiais base na lista e no filtro, escolhido entre sugestões ou escrito pelo dono. Não é cadastro próprio.

**Conversão de compra**:
Fator que transforma a embalagem comprada, como rolo, cone ou pacote, na unidade base. A variante guarda a embalagem padrão (rótulo e quanto ela tem na unidade base) e a compra copia esse fator, podendo sobrescrever.

**Local de estoque**:
Armário, prateleira ou área com saldo físico próprio. Lista plana, sem hierarquia.

**Movimento de estoque**:
Registro imutável de uma variação de saldo num ponto, com quantidade e valor assinados. Nasce por saldo de abertura, ajuste, transferência, compra, sessão de inventário, reconciliação de materiais ou estorno, e nunca é editado nem apagado.
_Evitar_: lançamento, entrada e saída

**Ponto de saldo**:
Combinação de variante de material, local e, quando a variante controla lote, lote. É a unidade em que o saldo é somado e de onde sai o custo médio de uma saída.

**Transferência**:
Movimentação entre dois locais, gravada como um par de movimentos ligados: a saída na origem e a entrada no destino, com a mesma quantidade e o mesmo valor.

**Estorno de movimento**:
Movimento contrário que referencia um movimento lançado por engano e o marca como estornado. Cada movimento aceita um só; estornar uma perna de transferência estorna a outra junto.
_Evitar_: cancelamento, exclusão

**Lote**:
Rolo ou aquisição identificável de uma variante de material, com quantidade própria e custo de entrada derivado dos movimentos que entraram nele. O uso é opcional por variante, declarado na criação da variante e imutável depois dela.

**Saldo de abertura**:
Quantidade ou valor existente no dia da instalação, registrado como movimento auditado que não é compra nem faturamento.

**Reserva prevista**:
Quantidade de material comprometida para um subitem na aprovação da OS, calculada sobre a disponibilidade da hora da gravação, sem reduzir o saldo físico. Deixa de contar quando o subitem é reconciliado e volta a contar se a reconciliação for estornada.

**Disponibilidade**:
Saldo físico somado de todos os locais e lotes menos todas as reservas previstas da variante.

**Pendência de abastecimento**:
Falta entre o previsto de um subitem e o que ficou reservado, derivada na leitura e rastreada até a ordem que a causou.

**Lista de compras consolidada**:
Soma das pendências de abastecimento com a reposição até o alvo, explicando a origem de cada quantidade.

**Mínimo e alvo**:
Limite abaixo do qual a variante pede reposição e quantidade até a qual a lista sugere comprar.

**Custo de referência**:
Custo por unidade base que o dono informa na variante antes de existir compra, usado como ponto de partida para preço sugerido e custo provisório. Só o dono vê.

**Fornecedor**:
Loja ou pessoa de quem o ateliê compra material, com nome e contatos. É o que agrupa o histórico de compras.

**Compra**:
Registro imutável do que chegou de um fornecedor: itens com variante, local, embalagem, quantidade de embalagens e preço por embalagem, mais frete e desconto. Cada item entra no estoque como movimento de compra, e a compra nasce com a sua obrigação. Correção é o estorno da compra inteira.
_Evitar_: pedido, nota de entrada

**Rateio**:
Divisão do frete e do desconto de uma compra entre os itens, na proporção do total de cada linha, com cada item arredondado para baixo e o centavo que sobra no último item que tem valor; brinde não recebe nada.

**Custo de aquisição**:
Custo de um item da compra: total da linha mais a parte do frete menos a parte do desconto, depois do rateio.

**Estorno de compra**:
Registro que desfaz uma compra inteira: devolve os movimentos de estoque pelo valor de entrada, estorna o pagamento, se houver, e cancela a obrigação. Cada compra aceita um só.
_Evitar_: cancelamento de compra, exclusão

**Consumo real**:
Quantidade retirada para produção, possivelmente de vários locais e lotes, que reduz o saldo físico. Na OS, é registrado pela reconciliação da peça, com o lote mais antigo sugerido.

**Troca de material**:
Uso de material diferente do planejado, com a mesma unidade base, registrando previsto, usado, motivo e diferença de custo.
_Evitar_: substituição silenciosa

**Custo provisório**:
Valor temporário da parte de um consumo ou venda legítima que o custo médio do ponto não cobre: a que passa do saldo, pelo custo médio quando o ponto ainda tinha saldo e valor não negativo, ou a saída inteira de um ponto sem custo médio (valor negativo), pelo custo de referência da variante, senão zero (sem custo). Fica marcado para o ajuste de custo.

**Ajuste de custo**:
Evento posterior e auditável que corrige a diferença entre o custo provisório e o custo real, sem reescrever o evento original.

**Custo médio da variante**:
Custo ponderado de um produto acabado, atualizado pelas entradas de OP.

**Custo congelado**:
Custo da unidade fixado no momento da venda; é ele que volta ao estoque numa devolução vendável.

**Custo de produção capitalizado**:
Custo de uma OP atribuído às unidades boas em estoque e reconhecido no resultado quando elas são vendidas.

**Sessão de inventário**:
Contagem física às cegas dos pontos de um ou mais locais, feita num rascunho do aparelho e finalizada de uma vez com motivo e data. Guarda o que foi contado e o saldo esperado de cada linha, inclusive as que bateram, e gera um movimento de inventário por ponto com sobra ou falta. O que não foi contado fica como está. Na tela aparece como contagem.
_Evitar_: balanço, ajuste em lote

**Saldo esperado**:
Saldo que o sistema conhecia num ponto na hora em que a contagem dele foi digitada. A diferença entre o contado e o esperado é o ajuste, somado ao saldo que o ponto tiver na finalização.

**Sobra e falta**:
Diferença de uma linha da contagem. Sobra é o contado acima do esperado e entra pelo valor informado; falta é o contado abaixo do esperado e sai pela média do ponto.

**Ajuste rápido**:
Correção pontual de saldo de um item, com motivo obrigatório.

**Exceção de sobre-venda**:
Situação aberta quando vendas reais, feitas offline em aparelhos diferentes, deixam o acabado negativo. Resolve-se por reposição, produção, devolução ou cancelamento.

## Finanças

**Faturamento**:
Valor gerencial de OSs aprovadas e vendas diretas, reduzido por cancelamentos e devoluções no período do evento. Não é emissão fiscal.
_Evitar_: receita fiscal, nota

**Competência**:
Leitura de vendas e custos pela data do evento comercial ou do consumo, independente do dinheiro.

**Caixa**:
Leitura do dinheiro recebido, pago ou transferido nas contas do ateliê.

**Conta financeira**:
Local onde o dinheiro do ateliê está, como dinheiro físico, banco, conta Pix ou conta de liquidação. O saldo é a soma dos movimentos financeiros dela.

**Movimento financeiro**:
Registro imutável de uma variação de saldo numa conta, com valor assinado. Nasce por saldo de abertura, transferência entre contas, quitação ou estorno; um estorno não se estorna.
_Evitar_: lançamento

**Conta de liquidação**:
Conta intermediária em que valores de cartão aguardam repasse ao banco.

**Recebível**:
Valor devido por cliente numa OS ou venda, possivelmente dividido em entrada e parcelas livres. Na OS, nasce na aprovação com o total da revisão; total zero não cria recebível.

**Pagamento**:
Recebimento bruto que pode combinar meios e contas e ser alocado a vários recebíveis do mesmo cliente.

**Alocação**:
Parte de um pagamento aplicada a um recebível específico.

**Taxa de recebimento**:
Despesa de cartão ou plataforma vinculada a um pagamento; o cliente quita pelo bruto e a conta recebe o líquido.

**Excedente a reembolsar**:
Valor recebido acima do devido, que fica visível até um reembolso ou estorno explícito.
_Evitar_: crédito do cliente

**Reembolso**:
Saída financeira explícita que devolve ao cliente um valor já recebido. Nunca vira crédito automático.

**Obrigação de compra**:
Valor a pagar por aquisição recebida, com um único vencimento, criado junto da compra; na compra paga na hora, já nasce quitada. Fica aberta, paga ou cancelada conforme as quitações e o estorno da compra. A compra eleva o estoque e não é despesa imediata.

**Quitação**:
Pagamento integral de uma obrigação a partir de uma conta, numa data. Estornar a quitação reabre a obrigação. Na tela aparece como "Pagar".

**Despesa direta**:
Gasto vinculado a uma OS ou OP que refina sua margem real.

**Despesa geral**:
Gasto do ateliê, como aluguel ou energia, que afeta só o resultado do período, sem rateio.

**Obrigação recorrente**:
Despesa prevista gerada por um modelo periódico, que só afeta o caixa quando paga.

**Aporte e retirada do dono**:
Entrada ou saída de capital do dono que altera o saldo sem ser receita nem despesa operacional.

**Conferência de caixa**:
Comparação opcional entre o saldo calculado do dinheiro físico e o valor contado, com diferença justificada.

**Histórico de negócio**:
Versões, documentos e movimentos preservados indefinidamente, sem reescrever fatos anteriores.

## Acesso, dispositivos e recuperação

**Dono**:
Única conta humana do sistema, autenticada por usuário e senha.
_Evitar_: administrador, usuário

**Wizard inicial**:
Configuração retomável do primeiro acesso cujos passos obrigatórios são identidade do ateliê, conta, códigos de recuperação e pasta de backup testada.

**Instalação**:
Registro único do servidor com a identidade do ateliê, o passo do wizard, o epoch de sincronização e a pasta de backup testada.

**Checklist de continuidade**:
Tarefas de configuração opcionais que aparecem depois do wizard, como logo, catálogo, saldos de abertura e Tunnel.

**Busca global**:
Busca por texto aberta de qualquer tela, que acha clientes, perfis de usuário da peça, produtos, materiais e serviços pelo nome, por um trecho do telefone ou pelo código de uma variante, e leva ao registro. Abre como diálogo de busca rápida sobre a tela atual, com os primeiros de cada grupo, e segue para a página de busca com a lista completa, uma aba por grupo. Arquivados só aparecem quando pedidos, e cliente anonimizado nunca.
_Evitar_: pesquisa, filtro

**Sandbox de demonstração**:
Ambiente descartável e isolado que ensina o fluxo completo sem tocar dados reais.

**Origem canônica**:
Subdomínio HTTPS único pelo qual a PWA móvel é instalada e sincroniza.

**Acesso local**:
Interface aberta no navegador do próprio PC servidor pela origem de loopback, com sessão do dono. Opera sem internet e é a única via das ações administrativas.
_Evitar_: app desktop, cliente desktop, Tauri

**Dispositivo aprovado**:
Celular ou navegador que o dono autorizou no acesso local, diretamente ou por código de ativação, a receber o espelho completo dos dados.

**Revogação**:
Retirada da aprovação de um dispositivo, que só limpa o aparelho quando ele volta a se conectar.

**Código de ativação**:
Código de uso único e validade curta, emitido no acesso local, com o qual um aparelho já se registra aprovado.

**Segredo do dispositivo**:
Credencial aleatória entregue uma única vez no registro do aparelho e exigida em todo sync junto com a sessão do dono.

**Bloqueio remoto**:
Suspensão temporária e progressiva do login pelo Tunnel depois de falhas seguidas. Nunca afeta o acesso local nem sessões já abertas.

**Operação**:
Comando que muda estado, identificado por `opId`, cujo resultado fica gravado para que a repetição devolva a mesma resposta.
_Evitar_: requisição, evento

**Log de mudanças**:
Sequência de estados de agregados em ordem de cursor crescente, que o pull entrega aos dispositivos.

**Evento de auditoria**:
Registro permanente e append-only de ação sensível, sem senha, código, segredo nem usuário digitado.

**Cofre offline**:
Dados e arquivos operacionais cifrados no dispositivo móvel.

**Senha do cofre**:
Senha forte própria de cada dispositivo que cifra o cofre e as exportações. Não é a senha de login e não é recuperável pelo servidor.

**PIN local**:
Bloqueio de tela após inatividade. Não é chave criptográfica.

**Outbox**:
Fila idempotente de operações e arquivos criados offline à espera de sincronização.

**Exportação da outbox**:
Arquivo cifrado com a fila pendente de um dispositivo, importável numa nova instalação sem duplicar operações.

**Epoch de sincronização**:
Geração da base autoritativa. Uma restauração cria outra geração.

**Rebase de dispositivo**:
Atualização integral do estado local de um aparelho antes de reaplicar uma outbox antiga, sem limite de tempo offline.

**Conflito protegido**:
Edição feita sobre uma versão-base desatualizada, que nunca é resolvida por última gravação e vai para a caixa de conflitos.

**Caixa de conflitos**:
Área onde o dono revisa conflitos protegidos e exceções operacionais sem parar o restante da sincronização.

**Quarentena**:
Retenção, para decisão manual, de operações de epoch antigo, incompatíveis após restauração ou atualização, malformadas ou que reutilizam um `opId` com outro conteúdo.

**Código de recuperação**:
Credencial de uso único, entregue no wizard, para recuperar a conta e autorizar operações críticas.

**Resgate físico**:
Redefinição limitada e auditada da conta, com novos códigos de recuperação, por quem administra o sistema operacional do PC quando todos os códigos foram perdidos. Não abre cofres de dispositivos.

**Pacote de backup**:
Cópia validada do banco, fotos, PDFs e configurações não secretas, com manifesto. Exclui token do Tunnel e cofres móveis.

**Pré-backup**:
Pacote de backup criado automaticamente antes de uma restauração ou atualização.

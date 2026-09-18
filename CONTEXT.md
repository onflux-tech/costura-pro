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
Cópia das medidas aprovadas para um subitem de OS. Atualizar o perfil não altera o snapshot.

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
Atividade de costura ou terceirizada com custo interno fixo e preço padrão separados. O custo não inclui materiais listados à parte.

**Serviço terceirizado**:
Serviço executado fora do ateliê, com custo estimado substituído pela despesa real quando ela é vinculada.

**Produto base**:
Definição comum de um produto acabado e de sua ficha técnica.

**Variante de produto**:
Tamanho, cor ou apresentação vendável com código, preço, capa opcional e saldo próprios.

**Kit**:
Produto cuja unidade vendável representa o conjunto inteiro. Componentes só têm saldo se forem cadastrados como produtos próprios.

**Ficha técnica**:
Composição planejada de materiais, perdas normais e serviços de um produto base; a variante ajusta só o que difere.
_Evitar_: receita

**Galeria compartilhada**:
Imagens do produto base usadas por todas as variantes; a capa da variante substitui apenas a imagem principal.

**Margem desejada**:
Meta de margem sobre o preço de venda usada para sugerir preço. Nunca bloqueia venda.
_Evitar_: markup

**Preço sugerido**:
Custo estimado dividido por um menos a margem desejada.

**Preço praticado**:
Preço confirmado pelo dono em catálogo, orçamento ou venda. A sugestão não o altera automaticamente.

**Margem estimada**:
Margem congelada na aprovação de um orçamento, a partir dos custos estimados naquele momento.

**Margem real**:
Margem que evolui com consumo, perdas, despesas diretas e ajustes de custo posteriores à aprovação.

## Trabalho e venda

**Orçamento**:
Proposta comercial versionada ainda não aceita. Vencimento e aceite parcial exigem nova revisão.
_Evitar_: pedido

**Aceite parcial**:
Revisão do orçamento que contém somente os itens que o cliente aceitou.

**Aprovação**:
Registro manual, pelo dono, da data, do canal e de nota opcional do aceite do cliente. Não exige assinatura nem sinal.

**Código documental**:
Identificador humano permanente de um documento ou ordem, formado por tipo, ano, sigla do dispositivo e contador local, como `ORC-2026-CEL-0042`.
_Evitar_: número sequencial

**Ordem de Serviço (OS)**:
Trabalho sob medida ou reparo nascido de um orçamento aprovado, com subitens, produção, entrega e cobrança.
_Evitar_: pedido

**Subitem de trabalho**:
Peça ou serviço dentro da OS com medidas, materiais, etapas, prazo e entrega próprios.

**Estado de produção**:
Posição de um subitem no fluxo de produção, independente de entrega e pagamento.

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
Versão das etapas possíveis, comum a OS e OP. Cada trabalho recebe a versão vigente ao ser criado e só muda por migração manual.

**Etapa aplicável**:
Etapa do fluxo selecionada para um trabalho; as demais são puladas sem transição manual.

**Reconciliação de materiais**:
Confirmação, antes de marcar um subitem pronto, do que foi consumido, devolvido ao estoque e perdido.

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
Material ou unidade que não se torna produto bom e cujo destino e custo são registrados.

**Saída parcial de OP**:
Entrada de unidades boas no estoque antes do fechamento da OP, com custo provisório.

**Venda direta**:
Venda de produto acabado disponível, sem orçamento nem OS, com cliente opcional.

**Atendimento vinculado**:
Venda direta e OS de ajuste da mesma peça, ligadas entre si com históricos separados.

**Devolução de venda**:
Retorno de produto vendido com motivo, reembolso quando devido e destino: vendável, danificado ou perda.

**Insumo não controlado**:
Material usado num trabalho sem movimento de estoque, como retalho antigo, com custo estimado opcional.
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
Registro imutável de uma variação de saldo num ponto, com quantidade e valor assinados. Nasce por saldo de abertura, ajuste, transferência, compra ou estorno, e nunca é editado nem apagado.
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
Quantidade de material comprometida na aprovação da OS, sem reduzir o saldo físico.

**Disponibilidade**:
Saldo físico menos reservas previstas.

**Pendência de abastecimento**:
Falta entre a reserva prevista e a disponibilidade, rastreada até a ordem que a causou.

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
Quantidade retirada para produção, possivelmente de vários lotes, que reduz o saldo físico.

**Troca de material**:
Uso de material diferente do planejado, registrando previsto, usado, motivo e diferença de custo.
_Evitar_: substituição silenciosa

**Custo provisório**:
Valor temporário usado quando um consumo ou venda legítima deixa o saldo negativo.

**Ajuste de custo**:
Evento posterior e auditável que corrige a diferença entre o custo provisório e o custo real, sem reescrever o evento original.

**Custo médio da variante**:
Custo ponderado de um produto acabado, atualizado pelas entradas de OP.

**Custo congelado**:
Custo da unidade fixado no momento da venda; é ele que volta ao estoque numa devolução vendável.

**Custo de produção capitalizado**:
Custo de uma OP atribuído às unidades boas em estoque e reconhecido no resultado quando elas são vendidas.

**Sessão de inventário**:
Contagem física em lote com prévia das divergências, que gera ajustes auditados ao finalizar.

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
Valor devido por cliente numa OS ou venda, possivelmente dividido em entrada e parcelas livres.

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

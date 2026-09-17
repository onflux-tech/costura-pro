---
status: accepted
date: 2026-09-17
---

# Mídia endereçada por conteúdo, com rota própria e apagamento sem promessa forense

Fotos e demais arquivos de mídia são identificados pelo SHA-256 do próprio conteúdo. O aparelho otimiza a foto, calcula o hash e envia os bytes por `PUT /api/media/<hash>`; o servidor confere tipo pelos bytes, tamanho e hash, grava o arquivo de forma atômica em `<pasta do banco>/media/ab/cd/<hash>.<jpg|webp>` e só então cria ou renova a linha em `media_file`. O agregado que usa a foto (a peça recebida, por enquanto) guarda só os hashes no próprio payload, pelos comandos de sempre, e o servidor não confere se o arquivo existe. Arquivo sem referência sai por coleta com carência de 24 h; na anonimização do cliente, os arquivos dele saem na hora. Complementa a [ADR 0013](0013-contrato-minimo-de-sincronizacao.md), cujo envelope deixa de prever `mediaHashes`, e a [ADR 0014](0014-anonimizacao-redige-historico-de-sincronizacao.md), que passa a alcançar arquivos.

## Opções consideradas

- **Upload por procedure oRPC com `File`:** o servidor calcularia o hash, mas os bytes ficam em memória, a resposta é POST sem cache para `<img>`, e a outbox offline precisa do hash antes de enviar a operação.
- **Foto como agregado próprio com `version` e comandos:** versão e conflito não significam nada para bytes imutáveis, e cada foto viraria mais uma operação na fila.
- **Comando que exige o arquivo já enviado, com quarentena `mediaNotFound`:** a edição não tem caminho de rejeição no push, e o `keepLocal` de um conflito que referencia foto coletada ficaria impossível de resolver.
- **Variável `MEDIA_DIR` separada:** permite outro disco, mas quebra o `rename` atômico entre volumes e multiplica os espelhos de configuração; a pasta ao lado do banco pode mudar depois.
- **Sobrescrever o arquivo com zeros antes de apagar:** em SSD e NTFS com wear leveling quase não protege (NIST SP 800-88r2) e daria a impressão falsa de apagamento seguro.

## Consequências

- O upload é idempotente pelo próprio hash, sem `opId`: repetir responde 200 sem regravar e renova a carência; linha sem arquivo recebe o arquivo de novo.
- O servidor aceita só JPEG e WebP detectados pelos bytes, até 4 MiB; o `Content-Type` enviado é ignorado e o corpo é contado em streaming.
- O arquivo final nunca é regravado quando já tem o mesmo hash, o que evita `rename` sobre arquivo aberto no Windows; final corrompido é apagado antes do `rename`.
- A linha de `media_file` só existe depois do arquivo conferido; referência sem arquivo aparece como "Foto indisponível" na tela, visível e sem quarentena nova.
- Coleta no boot e de hora em hora apaga linhas sem referência em peças e em conflitos abertos, com último envio há mais de 24 h, arquivos sem linha com mais de 24 h e temporários com mais de 1 h; cada decisão acontece dentro de uma trava por hash compartilhada com o upload e a anonimização.
- Formulário aberto por mais de 24 h entre enviar a foto e salvar pode perder a foto para a coleta; a tela mostra "Foto indisponível" e o dono tira de novo.
- Na anonimização, as linhas de `media_file` dos hashes do cliente saem na mesma transação, antes do checkpoint do WAL, e os arquivos depois do commit; falha ao apagar um arquivo não muda a resposta e fica para a coleta.
- O caminho `/api/media/**` fica fora do evlog, porque a URL carrega o hash.
- Apagar arquivo não garante destruição física: SSD, backups antigos até expirar e o cache HTTP `private, immutable` do aparelho podem guardar a foto.
- A quantidade da peça recebida é contagem inteira de 1 a 999 em `number`, exceção como a da medida de corpo da [ADR 0015](0015-medidas-em-milimetros-e-medicao-autocontida.md): peça recebida não é estoque nem faturamento, e o `Quantity` em milionésimos da [ADR 0010](0010-dinheiro-e-quantidade-inteiros.md) não se aplica.

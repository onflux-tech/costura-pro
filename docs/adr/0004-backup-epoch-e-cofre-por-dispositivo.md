---
status: accepted
date: 2026-09-15
---

# Restaurar a autoridade sem apagar trabalho offline

Uma restauração de backup cria uma nova geração da base e troca o epoch de sincronização; filas de geração antiga ficam em quarentena para reaplicação manual, porque reenviá-las automaticamente poderia desfazer a própria restauração. Como a sessão móvel offline não expira, cada aparelho aprovado guarda seus dados num cofre cifrado por senha forte própria, com PIN apenas de tela e exportação portátil da outbox.

## Opções consideradas

- **Reaplicar todas as filas após restaurar:** sobrescreve silenciosamente o estado restaurado.
- **Descartar filas antigas:** perde vendas e pagamentos reais feitos offline.
- **PIN como chave do cofre:** 4 a 6 dígitos não resistem a ataque offline sobre o arquivo copiado.
- **Reutilizar a senha de login no cofre:** trocar ou recuperar a senha tornaria dados antigos ilegíveis.
- **Sessão offline com validade de 7 ou 30 dias:** o dono preferiu não impor prazo e compensar com PIN, cofre e aprovação de aparelho.

## Consequências

- O pacote de backup não é cifrado, por escolha do dono; a pasta de backup é dado sensível e o token do Tunnel e os cofres ficam fora dele.
- Restauração exige código de recuperação e cria pré-backup.
- Senha do cofre esquecida obriga a apagar o cofre e reconstruir o espelho; outbox não exportada é perdida.
- Revogação só limpa o aparelho quando ele volta a se conectar.

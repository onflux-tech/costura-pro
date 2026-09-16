---
status: accepted
date: 2026-09-16
---

# Dono único criado no acesso local, com login defendido no servidor

A conta do dono nasce só pelo comando `installation.createOwner`, chamado no acesso local ([ADR 0011](0011-servico-do-so-e-acesso-local-no-navegador.md)) enquanto a instalação está no passo `atelier`. O comando reserva o passo por compare-and-set no SQLite e cria o usuário com `auth.api.signUpEmail` dentro do servidor; nenhuma rota HTTP de cadastro responde, porque o Hono só repassa ao Better Auth uma allowlist de rotas. Um hook de banco recusa qualquer segundo usuário. O login é por username, com rate limit do Better Auth persistido no banco e um bloqueio remoto global e progressivo que nunca tranca o acesso local. Códigos de recuperação e segredos de dispositivo ficam só como SHA-256; o código de ativação, curto e de vida curta, fica como HMAC-SHA-256 com o segredo do servidor.

## Opções consideradas

- **Cadastro HTTP aberto com hook `before` que rejeita depois do bootstrap:** durante o bootstrap, qualquer cliente que alcança o servidor disputa a conta.
- **`disabledPaths` do Better Auth no lugar da allowlist:** toda rota nova de uma versão futura nasceria aberta; além disso, `disabledPaths` vale só no HTTP.
- **Só o rate limit por IP do Better Auth:** a chave é `ip|rota`, então um ataque distribuído por muitos IPs passa.
- **Bloqueio por username digitado:** revelaria se o usuário existe e permitiria trancar o dono também no PC.
- **Códigos de recuperação curtos com scrypt ou HMAC com o segredo do servidor:** scrypt multiplica o custo de cada tentativa sem ganho sobre 80 bits; HMAC deixa de valer quando o segredo se perde, justamente numa restauração em PC novo.
- **Código de ativação em SHA-256 puro:** com 8 caracteres (40 bits), quem tem uma cópia do banco inverte o hash por força bruta em pouco tempo; como o código vale 10 minutos, perder o segredo numa restauração só o invalida.

## Consequências

- Existe no máximo um usuário, provado por teste com dois `createOwner` concorrentes e por `signUpEmail` direto depois do bootstrap.
- Pelo Tunnel não há rota de cadastro, de disponibilidade de username nem de recuperação; o reset de senha com código é só local e derruba todas as sessões.
- O rate limit usa o IP de `cf-connecting-ip`; requisições locais não trazem esse cabeçalho e dividem um único balde de 5 tentativas por 60 s.
- Cinco falhas remotas seguidas bloqueiam o login remoto por 1 min, dobrando até 30 min; sessões abertas continuam valendo e o PC nunca é bloqueado por falha remota.
- O pacote de backup não é cifrado, então códigos de recuperação (80 bits) e segredos de dispositivo (256 bits) ficam só em SHA-256, e o código de ativação (40 bits) em HMAC-SHA-256; nenhum resultado de operação guarda o valor em claro.
- A auditoria fica em tabela append-only (triggers recusam UPDATE e DELETE) e nunca registra senha, código, segredo ou username tentado.

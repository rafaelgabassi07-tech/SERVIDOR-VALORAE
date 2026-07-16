# Checkpoint 367 — Logo source performance v335

## Objetivo

Remover a integração que exigia token privado do projeto, identificar de forma verificável qual fonte fornece cada logotipo e reduzir o tempo/custo de carregamento repetido.

## Implementação

- Yahoo Finance e Investidor10 iniciam em paralelo; o primeiro arquivo de imagem válido decide a resposta.
- StatusInvest permanece apenas como contingência final.
- Cada imagem é validada por ticker, host, assinatura binária, tamanho e dimensões.
- Requisições simultâneas do mesmo ticker compartilham uma única resolução em voo.
- Cache positivo: 30 dias; stale-if-error: 90 dias; cache negativo: 90 segundos.
- ETag/If-None-Match permite resposta 304 sem retransmitir os bytes.
- A rota JSON e os cabeçalhos expõem provedor, tier, fonte, cache, tentativas e latência.

## Fontes observadas

- Investidor10 apresenta imagens identificadas para ações e FIIs nas páginas dos próprios ativos.
- Yahoo continua útil como atalho quando publica `companyLogoUrl`, caso observado historicamente em PETR4.
- StatusInvest não participa do caminho primário por já ter retornado imagens genéricas em testes anteriores.

## Segurança e fidelidade

Nenhum logo é gerado ou simulado. Uma imagem só é armazenada quando passa pelas validações; caso contrário, o APK mantém o monograma local.

## Validação

- Build seguro para Vercel aprovado.
- 414 arquivos JavaScript verificados sintaticamente.
- 217 arquivos de teste aprovados, sem falhas.
- 24 testes APK↔Proxy aprovados.

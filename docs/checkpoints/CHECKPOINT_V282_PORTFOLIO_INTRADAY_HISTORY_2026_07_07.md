# Checkpoint Proxy v282 — Histórico intradiário da carteira

Patch: `21.12.311-portfolio-intraday-history-v282`

## Causa raiz

O endpoint `/api/v1/portfolio/history` agrupava pontos intradiários usando apenas `YYYY-MM-DD`. Em períodos como 1D e 5D, múltiplos pontos do Yahoo no mesmo dia viravam uma única linha. Depois, o ponto atual removia a linha do mesmo dia e deixava a resposta com um único ponto, forçando o APK a desenhar fallback linear.

## Correção

- Séries intradiárias preservam `timestamp`.
- A carteira é mesclada por timestamp, com forward-fill do último preço conhecido por posição.
- O ponto atual substitui apenas ponto muito próximo; caso contrário, é anexado ao final.
- O fallback sintético só é usado quando não há histórico remoto suficiente.

## Validação

- `test/portfolio-history-intraday-v282.test.js` confirma múltiplos pontos no mesmo dia, `fallbackUsed=false` e pontos com `timestamp`.

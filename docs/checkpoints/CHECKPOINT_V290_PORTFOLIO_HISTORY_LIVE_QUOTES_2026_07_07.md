# Proxy v290 — Preço da carteira em tempo real

Correção focada no gráfico **Preço da carteira**: o roteador principal agora encaminha `/api/v1/portfolio/history` para `buildPortfolioHistory` quando o payload contém posições/tickers, usando o motor intraday/transacional já existente.

## Correções

- `/portfolio/history` deixou de cair automaticamente em `buildRealMarketHistory` quando há carteira informada.
- Filtros 1D, 5D, 1M, 3M, 6M, 1A, 5A e MAX passam a ser respeitados pelo motor de histórico em tempo real.
- `buildRealMarketHistory` permanece como fallback apenas quando o payload não contém posições.
- Resposta inclui `routeEngine: VALORAE_REALTIME_PORTFOLIO_HISTORY_V290` para diagnóstico.

## Validação

- `node test/portfolio-history-router-realtime-v290.test.js`
- `npm run build`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

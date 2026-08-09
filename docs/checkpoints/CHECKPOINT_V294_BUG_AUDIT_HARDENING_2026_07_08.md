# Checkpoint v294 — Auditoria de bugs e contratos de carteira

## Escopo
Auditoria focada em bugs no Proxy, mantendo compatibilidade com APK v434.

## Correções
- `normalizePortfolioPositions()` agora aceita `positions` como JSON string.
- `normalizePortfolioPositions()` aceita aliases `symbols` e `symbol`, além de `tickers` e `ticker`.
- `normalizePortfolioTransactions()` agora aceita `transactions` como JSON string.
- `buildPortfolioHistory()` reconstrói posições a partir de `options` quando chamado sem `positions[]`, corrigindo o caminho do roteador principal `/api/v1/portfolio/history` em chamadas por query-string.
- Adicionado `test/portfolio-query-contract-v294.test.js`.

## Validação
- `npm run build`
- `npm run check:syntax`
- `node test/portfolio-query-contract-v294.test.js`
- `npm test`
- `npm run audit:version`

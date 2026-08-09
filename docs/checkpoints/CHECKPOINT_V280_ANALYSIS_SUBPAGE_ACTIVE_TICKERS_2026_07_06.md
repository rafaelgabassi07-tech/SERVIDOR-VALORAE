# Checkpoint V280 — Ativos negociados nas subpáginas da Análise

Patch: `21.12.309-analysis-subpage-active-tickers-v280`

## Objetivo

Fornecer ao APK metadados claros de negociação para filtrar tickers históricos/inativos nas listas das subpáginas da Análise.

## Mudanças

- `/api/v1/quotes` passa a devolver `listingStatus`, `tradingStatus`, `isTradable`, `tradable`, `activeTrading` e `partial`.
- `isTradable=true` exige preço positivo no retorno de cotação.
- Tickers sem cotação positiva ficam como `INACTIVE_OR_UNAVAILABLE` e `partial=true`.
- Sem denylist fixa e sem dados inventados.

## Validação

- `node test/analysis-subpage-trading-status-v280.test.js`
- `npm run build`
- `npm run check:syntax`
- `npm test`
- `node scripts/audit-version-consistency.js`
- `node scripts/audit-version.js`

# Checkpoint v256 — Histórico de Indicadores via REST Investidor10

Objetivo: reativar o Histórico de Indicadores Fundamentalistas do modal de ação usando o endpoint REST informado pelo usuário: `/api/rest/assets/tickers/{TICKER}`.

## Implementação

- Adicionado `assetTickerRest` em `fetchInvestidor10StockApiExtras`.
- A resposta do endpoint entra também em `historicoIndicadoresSources`.
- Adicionada coleta recursiva de candidatos de indicadores em payloads REST complexos.
- Reativado `historicalIndicators` no contrato `26.asset-modal.stock.v37`.
- Sem fallback estático por ticker.

## Validação

- `node test/stock-modal-historical-indicators-rest-i10-v256.test.js`
- `npm test`

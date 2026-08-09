# Checkpoint v269 — Auditoria do histórico de indicadores fundamentalistas

## Objetivo

Endurecer o funcionamento da seção “Histórico de indicadores fundamentalistas” no modal de ação para ativos além de AURE3/PETR4, priorizando a API REST do Investidor10 `GET /api/rest/assets/tickers/{TICKER}` e mantendo HTML como fonte auxiliar real.

## Alterações

- Contrato de ação elevado para `26.asset-modal.stock.v48`.
- Inclusão de tentativa da API REST de ticker com ticker maiúsculo, minúsculo, com e sem barra final.
- `buildStockHistoricalIndicatorSources()` agora varre o `rawJson` completo do Investidor10 em busca de containers alternativos de histórico, em vez de depender apenas de aliases fixos.
- `extractInvestidor10StockHistoricalIndicatorsFromHtml()` passou a detectar linhas com separadores reais do site: vírgula, ponto e vírgula, barra vertical, travessão e quebras de layout.
- Mantida a política sem fallback PETR4/GGRC11, sem mock e sem WebView.

## Validação

- `node test/stock-modal-historical-indicators-api-audit-v269.test.js`
- Testes regressivos históricos v243, v256, v261 e v262.
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`
- `npm run build`

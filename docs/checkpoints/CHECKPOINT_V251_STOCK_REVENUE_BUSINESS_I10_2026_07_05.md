# Checkpoint v251 — Negócios que geram receita no modal de ações

Data: 2026-07-05  
Proxy: `21.12.280-stock-revenue-business-i10-v251`  
Contrato: `26.asset-modal.stock.v32`  
APK pareado: `v370`

## Escopo

Corrige o checkpoint 3 solicitado para ações: **Negócios que geram receita para a empresa**.

## Implementação

- Extração real do Investidor10 sem fallback por ticker.
- Suporte a variáveis/payloads JS inline:
  - `companyBussinesRevenuesChartPie`
  - `companyBussinessRevenuesChartPie`
  - `companyBusinessRevenuesChartPie`
  - `revenueSegment`
  - `revenueByBusiness`
  - `businessRevenue`
  - `segmentRevenue`
  - `productRevenue`
- Suporte a `JSON.parse`, objeto JS-like, Chart.js, Highcharts, tuplas e objetos por negócio/produto.
- Normalização de rótulo, valor exibido, percentual, total e ano selecionado.
- Rotas complementares best-effort para receita por negócio, segmento e produto.

## Política de dados

- Sem fallback PETR4/GGRC11.
- Sem mock em produção.
- Sem snapshot estático.
- Se a fonte real não entregar payload utilizável, o bloco permanece `EMPTY`.

## Validação

- `node --check lib/analysis/stock-modal-contract.js`
- `node --check lib/market/investidor10-chart-extractor.js`
- `node test/stock-modal-revenue-business-i10-v251.test.js`
- `node test/stock-modal-revenue-region-i10-v250.test.js`
- `node test/stock-modal-contract-v215.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

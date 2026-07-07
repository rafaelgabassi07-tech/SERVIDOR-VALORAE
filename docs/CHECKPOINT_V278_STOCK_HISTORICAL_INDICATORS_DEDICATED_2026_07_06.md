# Checkpoint V278 — Histórico fundamentalista de ações dedicado

Patch: `21.12.307-stock-historical-indicators-dedicated-v278`  
Contrato: `26.asset-modal.stock.v51`  
Data: 2026-07-06

## Objetivo
Refatorar o histórico de indicadores fundamentalistas do modal de ação para seguir o padrão mais estável usado no modal de FII: coletor dedicado, endpoints priorizados e normalização única antes do parser genérico.

## Correções
- Adicionado `fetchInvestidor10StockHistoricalIndicatorsRaw`, coletor dedicado para histórico fundamentalista de ações.
- Adicionado `stockHistoricalIndicatorEndpointCandidates`, com prioridade para rotas descobertas no HTML e endpoints reais por `companyId`, `tickerId` e ticker.
- Adicionado `normalizeStockHistoricalIndicatorsApi`, usando o contrato normalizado `columns`, `rows`, `tablesByPeriod`, `periods` e `selectedPeriod`.
- O Proxy agora injeta `stockHistoricalIndicatorsDedicatedSources` e `stockHistoricalIndicatorsNormalized` no contrato antes da varredura genérica.
- Mantidos os fallbacks reais já existentes: REST ticker, DataTables, chart/table, payloads embutidos e HTML quando existir tabela parseável.
- Sem fallback estático, mock ou dados inventados.

## Validação
- `node test/stock-modal-historical-indicators-dedicated-v278.test.js`
- `node test/stock-modal-historical-indicators-rest-i10-v256.test.js`
- `node test/stock-modal-historical-indicators-indexed-rows-v274.test.js`
- `node test/stock-modal-historical-indicators-api-audit-v269.test.js`
- `node test/stock-modal-contract-v215.test.js`
- `npm run check:syntax`

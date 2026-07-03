# Checkpoint v180 — Análise performance + chart source audit

## Escopo

Auditoria APK+Proxy focada em desempenho da página Análise, abertura de modais e fidelidade dos gráficos aos dados fornecidos por Investidor10/StatusInvest.

## Proxy

- `analysis-page-response.js` ganhou ordenação cronológica centralizada para pontos e períodos.
- `investidor10-chart-extractor.js` passou a ordenar séries temporais antes de compor o contrato canônico.
- Gráficos categóricos e de composição continuam preservando a ordem da fonte.
- Nenhum ponto sintético é criado; quando a fonte não entrega série suficiente, o contrato mantém ausência/limitação em vez de inventar fallback visual.

## Testes

- `test/analysis-chart-order-performance-v180.test.js` cobre séries mensais, anuais e trimestrais desordenadas.
- Validação final: `npm run verify`.

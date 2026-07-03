# Checkpoint v190 — Modais zerados para reconstrução

Superfícies de modal da Análise e dos ativos foram zeradas no Proxy. Para `analysis_asset_modal`, `portfolio_asset_modal`, `ranking_asset_modal` ou qualquer surface contendo `modal`, a rota `/api/v1/analysis` retorna contrato `RESET` vazio, sem chamar `buildAssetDetails` e sem consultar StatusInvest, Investidor10, Yahoo, B3, BCB ou fallbacks.

## Garantias

- `sections: []`
- `sources: []`
- `summary.totalItems: 0`
- `summary.totalCharts: 0`
- `diagnostics.sourceRequestsSkipped: true`
- Cache `no-store` para esses retornos de reset

A página Análise normal (`analysis_page`) permanece preservada para leitura completa enquanto os modais são redesenhados.

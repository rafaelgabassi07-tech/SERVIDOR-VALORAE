# Checkpoint Proxy v261 — Histórico de indicadores restaurado

- Contrato de ação: `26.asset-modal.stock.v42`.
- Correção: adiciona busca explícita dos endpoints reais do Investidor10 `/api/balancos/indicadores/table/{companyId}/3650/` e `/api/balancos/indicadores/chart/{companyId}/3650/`, além do REST `/api/rest/assets/tickers/{TICKER}`.
- Normalização: aceita tabela padrão, objeto por métrica, `labels/categories + series/datasets` no formato normal e no formato transposto (`categories` como indicadores e `series` como anos/períodos).
- Política: sem fallback PETR4/GGRC11, sem mock e sem dados simulados.
- Validação: `node --check`, testes específicos de histórico e suíte `npm test`.

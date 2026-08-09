# Checkpoint v169 — Auditoria completa de Análise, Carteira e Proxy

Data: 2026-07-02
Release Proxy: `21.12.199-full-audit-analysis-portfolio-v169`
Core: `21.12.0`
Compatível com APK: `v283-full-audit-analysis-portfolio-proxy`

## Correções aplicadas

- Unificada a normalização de tickers para impedir duplicidade entre `PETR4`, `PETR4.SA`, `B3:PETR4`, `BVMF:PETR4`, `PETR4F` e variações equivalentes.
- Corrigido o resumo da página Análise para que P/VP e DY sejam resolvidos por identificador do indicador.
- Ajustado Radar de Dividendos para não aparentar disponibilidade quando não há eventos reais normalizados.
- Radar específico de ações não é aplicado a FIIs.
- Mantida compatibilidade com `/api/v1/mobile/practical-sync` e contrato `valorae-mobile-portfolio-sync`.

## Validações

- `node scripts/check-syntax.js`
- `npm run build`
- `node scripts/run-tests.js`
- `node scripts/audit-version-consistency.js`
- `node scripts/audit-version.js`

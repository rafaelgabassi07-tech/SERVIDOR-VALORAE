# 2026-06-16 — Análise source routing real-only v44

Patch: `21.12.128-analysis-source-routing-real-only-v44`

## Objetivo

Revisar novamente, em checkpoints, a cadeia real da página Análise: APK → `/api/v1/analysis` → `buildAssetDetails` → HTML/API das fontes → `AnalysisPageResponse`.

## Correções

- BOVA11 passou a ser classificado como ETF e a tentar primeiro as páginas reais `/etfs/bova11/` nas fontes compatíveis.
- AAPL34 passou a ser classificado como BDR e a tentar primeiro as páginas reais `/bdrs/aapl34/` nas fontes compatíveis.
- ETFs não recebem nem sinalizam como falha blocos que não se aplicam ao tipo, como FII completo, checklist FII, DRE/Balanço/Fluxo e posição acionária.
- Histórico de payout não é mais criado a partir de indicador pontual.
- Histórico de dividend yield não é mais estimado por dividendos anuais divididos pela cotação atual.
- Demonstrativos financeiros não aceitam períodos artificiais como `P1`, `P2` ou `Atual` quando a fonte não trouxe data/período real.

## Política de dados

Quando a fonte não trouxer série real, o bloco fica vazio/sinalizado. O Proxy não preenche com dado simulado, inferido ou inventado.

# Patch 21.12.114 — Checkpoint 33: Comparadores da Análise

- A seção `comparisons` da página Análise passa a exibir comparadores reais por séries `multi_line`.
- Implementado `ativo x IBOV`, `ativo x IFIX`, `ativo x CDI` e `ativo x IPCA` quando o Proxy encontra séries confiáveis.
- Suporte opcional a `SMLL` e `IDIV` quando já vierem de fonte real existente, como a política do modal Retorno via Yahoo/B3.
- O Proxy rejeita próprio ticker, proxy ticker, ETF substituto, série simulada, série sintética e comparador sem série do ativo.
- O APK ganhou `ComparisonAnalysisBlock` e `ComparisonMetricRow` para separar índices, pares semelhantes e demais comparadores.
- Mantido `/api/v1/analysis` como contrato único da Análise.
- Mantidos `versionCode` e `versionName` do APK sem alteração.

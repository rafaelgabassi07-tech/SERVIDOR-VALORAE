# 2026-06-16 — Análise por categorias e gráficos sempre visíveis

Patch: `21.12.123-analysis-clean-categories-visible-charts-v39`

## Ajustes

- Amplia a extração de receita por negócio/região com caminhos adicionais usados por fontes estruturadas similares ao AeroScraper.
- Mantém percentuais inválidos, zerados ou acima de 100% fora dos gráficos.
- Preserva o contrato único `/api/v1/analysis` e `AnalysisPageResponse`.
- Adiciona teste regressivo para garantir receita por negócio/região e bloqueio de regressões visuais no APK.

## Validação

- `npm run check`
- `npm test`

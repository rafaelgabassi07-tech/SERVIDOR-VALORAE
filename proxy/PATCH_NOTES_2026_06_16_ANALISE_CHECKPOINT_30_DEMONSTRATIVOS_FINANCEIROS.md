# Checkpoint 30 — Demonstrativos financeiros na Análise

## Objetivo

Completar a seção `financial_statements` do contrato único `/api/v1/analysis`, entregando DRE, Balanço e Fluxo de Caixa em JSON estruturado para o APK.

## Implementado

- Mantido contrato `AnalysisPageResponse` com `contractVersion = 26.analysis.v2`.
- Normalização de DRE: Receita líquida, Lucro bruto, EBIT, EBITDA e Lucro líquido.
- Normalização de Balanço: Ativos, Passivos, Patrimônio líquido, Dívida bruta, Dívida líquida e Caixa.
- Normalização de Fluxo de Caixa: Fluxo operacional, Fluxo de investimento e Fluxo de financiamento.
- Geração de `items[]` para tabela mobile.
- Geração de `charts[]` somente com séries reais de pelo menos dois períodos.
- Sem dados sintéticos.

## Validação

- `npm run check`: OK.
- `npm test`: OK, 28 test files, failures=0.
- Novo teste: `test/analysis-financial-statements-v30.test.js`.

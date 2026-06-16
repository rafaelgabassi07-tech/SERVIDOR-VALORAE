# 2026-06-16 — Checkpoint 29 — Histórico de Indicadores completo

## Objetivo

Completar a seção `historical_indicators` do contrato único da página Análise, sem criar dados sintéticos.

## O que mudou

- O endpoint `/api/v1/analysis` continua entregando `AnalysisPageResponse` com `contractVersion = 26.analysis.v2`.
- O Proxy agora normaliza formatos diferentes de histórico de indicadores:
  - `{ colunas, linhas[] }` vindo de APIs internas/Investidor10;
  - arrays de indicadores por período;
  - objetos por indicador/período;
  - séries confiáveis já capturadas em `assetChartBundle`.
- Para Ações, a seção prioriza:
  - P/L;
  - P/VP;
  - Dividend Yield;
  - ROE;
  - ROIC;
  - margens;
  - dívida;
  - liquidez;
  - crescimento de receita/lucro.
- Para FIIs, a seção prioriza:
  - P/VP;
  - Dividend Yield;
  - vacância;
  - valor patrimonial por cota;
  - rendimento por cota;
  - número de cotistas;
  - liquidez.
- A seção agora também pode enviar `charts[]` próprios para indicadores históricos quando houver pelo menos dois pontos numéricos reais.
- Quando não houver histórico real, a seção permanece `empty` e aparece em `missingSignals`.

## Política de dados

- Não simular valores ausentes.
- Não converter HTML para o APK.
- Não usar iframe, WebView ou imagem externa.
- O APK apenas renderiza JSON estruturado.

## Validação

- `npm run check`: passou.
- `npm test`: passou com 27 test files e failures=0.
- Novo teste: `test/analysis-historical-indicators-v29.test.js`.

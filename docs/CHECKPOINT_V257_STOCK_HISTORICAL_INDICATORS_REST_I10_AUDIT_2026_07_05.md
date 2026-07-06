# Checkpoint Proxy v257 — Auditoria do Histórico de Indicadores REST Investidor10

Data: 2026-07-05  
Patch: `21.12.286-stock-historical-indicators-rest-i10-audit-v257`  
Contrato de ação: `26.asset-modal.stock.v38`  
APK pareado: `apk_valorae_stock_historical_indicators_rest_i10_audit_v376_AI_STUDIO_ROOT_OK_2026_07_05.zip`

## Resultado esperado

O modal de ação deve preencher o bloco **Histórico de Indicadores Fundamentalistas** com todos os indicadores normalizáveis entregues pelo endpoint `GET https://investidor10.com.br/api/rest/assets/tickers/{TICKER}`, e não apenas `P/L` e `P/Receita (PSR)`.

## Causa auditada

A integração anterior já chamava o REST do Investidor10, mas o normalizador era restrito para algumas formas tabulares. Quando o payload vinha como objeto por métrica ou com chaves `camelCase`, parte dos indicadores era descartada por não reconhecer aliases como `pVp`, `dividendYieldDy`, `margemLiquida`, `evEbitda`, `dividaLiquidaEbitda` e `cagrReceitas5Anos`.

Também havia perda de contexto quando os anos/períodos estavam no nível pai (`periods`/`years`) e as métricas ficavam dentro de um objeto filho (`indicators`/`metrics`).

## Correções

- Normalização de chaves com quebra de `camelCase` antes da remoção de acentos e símbolos.
- `canonicalStockHistoricalLabel()` passa a usar a mesma normalização canônica do parser.
- Aliases adicionados para P/VP, Dividend Yield, Payout, margens, EV/Ebitda, EV/Ebit, P/Ebitda, P/Ebit, P/Ativo, VPA, LPA, ROE, ROIC, ROA, dívidas, liquidez e CAGRs.
- Parser de objetos por métrica (`metric map`) com preservação de colunas herdadas do nível pai.
- Suporte a linhas identificadas por `id`, `slug`, `code`, `codigo`, `field` e `metricName`.
- Suporte a séries aninhadas em `values`, `valores`, `data`, `series`, `history`, `historico`, `points` e equivalentes.
- Mantida a política: sem fallback PETR4/GGRC11, sem mock e sem dado inventado.

## Testes adicionados/reforçados

- Payload REST em formato `indicators_history.periods + indicators { pl, pReceitaPsr, pVp, dividendYieldDy, payout, margemLiquida, margemBruta, margemEbitda, evEbitda, pEbit, roe, roic, dividaLiquidaEbitda, cagrReceitas5Anos }`.
- Payload REST em formato `historical_indicators.years + metrics[]` com `id`, `slug`, `code` e `metricName`.
- Asserts impedem regressão para o cenário de apenas `P/L` e `P/Receita (PSR)`.

## Validação executada

- `node --check lib/analysis/stock-modal-contract.js`
- `node test/stock-modal-historical-indicators-rest-i10-v256.test.js`
- `npm test` — 124 arquivos, 0 falhas
- `npm run audit:version`

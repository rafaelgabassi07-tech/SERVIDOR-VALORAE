# Proxy v166 — Liquidez média diária para a Análise

Versão: 21.12.196
Patch: `21.12.196-analysis-liquidity-quotes-v166`

## Alterações

- `/api/v1/quotes` passa a devolver liquidez média diária em campos compatíveis com o APK: `dailyLiquidity`, `averageDailyLiquidity`, `liquidezMediaDiaria` e `liquidezDiaria`.
- Inclui displays compactos como `dailyLiquidityDisplay`, `liquidityDisplay` e `liquidezMediaDiariaDisplay`.
- Preserva compatibilidade com cotação, variação do dia, P/VP e DY já usados pela tabela das subpáginas da Análise.

## Validação

- `npm run build`.

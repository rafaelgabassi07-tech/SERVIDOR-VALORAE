# Proxy 21.12.404 — compatibilidade APK v644 e rankings semânticos v3

Data: 2026-08-09  
APK pareado: `2026.08.09.07`

## Alteração funcional

O endpoint existente `/api/v1/analysis/rankings` foi preservado. O parser do Investidor10 foi fortalecido para aceitar uma tabela cujo cabeçalho primário responsivo não seja reconhecido textualmente quando a métrica principal está estruturalmente na coluna imediatamente posterior a `Ativos`.

O fallback é deliberadamente restrito à métrica primária. Todas as métricas secundárias continuam mapeadas por nome do cabeçalho.

## Rankings cobertos pelo novo teste

- `FII_PVP_LOW`
- `FII_PVP_HIGH`
- `STOCK_ROE`
- `STOCK_PL_LOW`
- `STOCK_PROFIT_GROWTH_5Y`
- `STOCK_REVENUE_GROWTH_5Y`
- `STOCK_NET_MARGIN`

O contrato interno avança de `analysis-rankings-semantic-v2` para `analysis-rankings-semantic-v3`, sem alteração de rota pública.

## Testes

- `test/analysis-rankings-primary-metrics-v644.test.js`
- `test/analysis-rankings-i10-v629.test.js`
- `test/analysis-rankings-stock-expansion-v640.test.js`
- `test/apk-v644-rankings-ui-compatibility.test.js`

## Resultado da validação

- `analysis-rankings-primary-metrics-v644.test.js`: aprovado para os sete rankings afetados.
- `analysis-rankings-i10-v629.test.js`: aprovado.
- `analysis-rankings-stock-expansion-v640.test.js`: aprovado.
- `apk-v644-rankings-ui-compatibility.test.js`: aprovado.
- `npm run build`: aprovado.
- `npm run check:syntax`: **442 arquivos JavaScript** verificados.
- `npm run audit:version`: aprovado.
- Suíte completa: **286 testes**, sendo **182 aprovados**, **100 bloqueados por dependências opcionais** e **4 falhas históricas**, as mesmas da v643; **zero regressão nova**.

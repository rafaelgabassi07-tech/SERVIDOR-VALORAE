# 2026-06-16 — Revisão de fidelidade dos gráficos da Análise

Patch: `21.12.118-analysis-chart-source-fidelity-review`

## Objetivo

Revisar se os gráficos da página Análise estão fiéis à fonte e ao tipo de informação usada para construí-los.

## Correções

- Comparadores de índices/pares agora alinham séries por `label`/período comum antes de montar `multi_line`.
- Comparador sem ao menos dois períodos reais em comum é descartado.
- `Lucro x Cotação` foi corrigido de `line` para `multi_line`, pois contém duas séries.
- Distribuições percentuais de FIIs rejeitam valores inválidos: zero, negativos e acima de 100%.
- Todos os gráficos testados exigem `source` explícita e pontos numéricos finitos.

## Regras preservadas

- A Análise continua lendo somente `/api/v1/analysis`.
- O APK continua desenhando gráficos nativos em Canvas.
- Sem HTML, iframe, WebView, imagem externa, fallback falso ou dado simulado.

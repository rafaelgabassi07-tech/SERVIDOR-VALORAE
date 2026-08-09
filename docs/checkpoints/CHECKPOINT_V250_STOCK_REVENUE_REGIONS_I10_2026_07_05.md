# Checkpoint v250 — Regiões onde gera receita no modal de ações

Proxy: `21.12.279-stock-revenue-regions-i10-v250`  
Contrato: `26.asset-modal.stock.v31`  
APK pareado: `v369`

## Escopo
Corrige o checkpoint 2 solicitado: `Regiões onde (empresa) gera receita`.

## Correções
- Corrigida a regex de extração de variáveis JS inline do Investidor10 para aceitar `window.`, `const`, `let`, `var` e `JSON.parse`.
- Adicionada normalização segura de objeto JS-like, sem executar código externo.
- Adicionado suporte para `labels + datasets`, `series.data`, pontos Highcharts, arrays de objetos e mapas por região.
- Preservados `amountDisplay`, `percentDisplay`, `totalAmountDisplay`, `selectedYear` e `source`.

## Política de dados
Sem fallback por ticker, sem PETR4 fixo, sem GGRC11 fixo, sem mock e sem valores fabricados.

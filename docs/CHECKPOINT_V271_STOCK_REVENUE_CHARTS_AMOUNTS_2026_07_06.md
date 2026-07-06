# Checkpoint v271 — Receita por região/negócio com gráficos reais

Corrige a extração dos gráficos de **Regiões onde gera receita** e **Negócios que geram receita** no modal de ação para aceitar payloads reais do Investidor10 em formato de chart, inclusive quando os pontos vêm como valores monetários absolutos em vez de percentuais prontos.

## Ajustes

- Aceita séries Highcharts/Chart.js com `series`, `datasets`, `labels` e `data`.
- Converte valores monetários para participação percentual usando `totalAmountDisplay` quando disponível ou a soma dos pontos como total.
- Preserva `amountDisplay` em R$ para o APK exibir o valor real quando existir.
- Mantém bloqueio contra labels de indicadores/metadata como `tag_along`, `free_float`, `p_l`, `ev_ebitda`, margens e variações.
- Extrai charts inseridos no HTML dentro da seção correta do Investidor10, sem varrer blocos de posição acionária ou dados da empresa.

## Validação

- `node test/stock-modal-revenue-breakdown-amount-charts-v271.test.js`
- `node test/stock-modal-revenue-breakdown-strict-v270.test.js`
- `node test/stock-modal-revenue-business-i10-v251.test.js`
- `node test/stock-modal-revenue-region-i10-v250.test.js`
- `node test/stock-modal-revenue-breakdown-rest-i10-v260.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`
- `npm run build`

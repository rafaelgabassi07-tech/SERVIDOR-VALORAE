# Checkpoint v287 — Regiões e Negócios compatíveis com Vesto/Investidor10

## Correção aplicada

- Corrigida a causa raiz dos gráficos de Diversificação de receita por região e segmentos no modal de ação.
- O Proxy agora normaliza o formato inline real usado pelo Investidor10 e pelo fluxo Vesto/AeroScrape:

```json
{
  "2025": {
    "Brasil": { "value": 71 },
    "China": { "value": 11 }
  }
}
```

para o contrato móvel esperado pelo Valorae:

```json
{
  "status": "OK",
  "selectedYear": "2025",
  "items": [
    { "label": "Brasil", "percent": 71, "percentDisplay": "71%" },
    { "label": "China", "percent": 11, "percentDisplay": "11%" }
  ]
}
```

## Melhorias técnicas

- `rowsFromRevenueCandidate` passa a aceitar mapa por ano `20xx -> label -> { value }`.
- `objectMapRevenueRowsFromCandidate` desce no ano mais recente antes de descartar chaves numéricas.
- `revenueYearFromCandidate` seleciona o maior ano disponível, evitando escolher `2024` quando `2025` também está no payload.
- `value` numérico entre 0 e 100 passa a ser tratado como percentual da fatia de pizza, não como valor monetário.
- Mantida compatibilidade com Highcharts, Chart.js, DataTables/linhas indexadas, RESTs aninhados e aliases anteriores.

## Validação

- `node test/stock-modal-revenue-vesto-inline-map-v287.test.js`
- `node test/stock-modal-revenue-js-discovery-v286.test.js`
- `node test/stock-modal-revenue-highcharts-realistic-v284.test.js`
- `node test/stock-modal-revenue-rest-nested-custom-v284.test.js`
- `node test/stock-modal-revenue-breakdown-strict-v270.test.js`
- `node test/stock-revenue-contract-aliases-v281.test.js`
- `npm run build`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

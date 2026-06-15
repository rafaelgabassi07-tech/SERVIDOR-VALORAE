# Retorno: IFIX, IDIV e SMLL com snapshot Yahoo + curva histórica real

## Causa encontrada

A correção anterior ainda dependia de o Yahoo Finance entregar histórico com pelo menos 2 pontos para `IFIX.SA`, `IDIV.SA` e `SMLL.SA`. O endpoint confirmado pelo usuário:

```txt
https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range=1d&interval=1d&includePrePost=false
```

é adequado para snapshot/cotação do dia, mas pode entregar apenas 1 ponto. O modal de Retorno precisa de 2+ pontos reais para desenhar a curva comparativa; com somente snapshot, o APK continuava mostrando os índices como indisponíveis no gráfico.

## Correção aplicada

- Mantida a tentativa primária no Yahoo Finance Chart API com símbolos diretos:
  - `IFIX` -> `IFIX.SA`
  - `IDIV` -> `IDIV.SA`
  - `SMLL` -> `SMLL.SA`
- Mantida B3 `indexStatisticsPage/daily-evolution` como fonte oficial quando houver pontos parseáveis.
- Adicionado fallback de curva histórica mensal via Mais Retorno para `IFIX`, `IDIV` e `SMLL`.
- A curva é reconstruída a partir de rentabilidades mensais reais publicadas, sem ETF, sem proxyTicker, sem ativo substituto e sem série simulada.
- O contrato `/api/v1/portfolio/returns` passa a preencher `ifixReturnPercent`, `idivReturnPercent`, `smllReturnPercent` e `smal11ReturnPercent` quando Yahoo/B3 não entregarem histórico suficiente, mas a página de rentabilidade mensal estiver disponível.

## Validação

- `npm run check`: OK.
- `npm test`: OK, 18 arquivos de teste, 0 falhas.
- Novo teste cobre o cenário Yahoo snapshot-only + B3 vazia + fallback Mais Retorno com curva real mensal.

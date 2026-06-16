# Patch — Índices diretos do Retorno via Yahoo Finance Chart API

Data: 2026-06-14

## Fonte principal
- `IFIX` → `IFIX.SA`
- `IDIV` → `IDIV.SA`
- `SMLL` → `SMLL.SA`
- Endpoint confirmado para snapshot: `https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range=1d&interval=1d&includePrePost=false`

## Arquivos alterados
- `lib/market/yahoo.js`: preserva símbolos explícitos `.SA` e mapeia `IFIX`, `IDIV` e `SMLL` para os símbolos diretos do Yahoo.
- `lib/sources/asset-details.js`: usa Yahoo Finance Chart API como primeira fonte para `IFIX`, `IDIV` e `SMLL` no histórico do Retorno; B3 e Investidor10 ficam como fallback.
- `lib/market/indices.js`: snapshot de mercado passa a incluir `IFIX.SA`, `IDIV.SA` e `SMLL.SA`, com fallback B3 e último snapshot conhecido marcado como `staleFallback`.
- `routes/asset/history.js`: rota de histórico de índices passa pelo mesmo resolvedor do Retorno, com Yahoo direto + fallbacks.
- `lib/sources/quotes.js`: cotações pontuais desses índices também usam intervalo `1d` no Yahoo.

## Política de dados
- Não usar ETF, proxyTicker, ativo substituto ou valor inventado para o gráfico de rentabilidade comparada.
- Snapshot stale é permitido apenas como snapshot atual e explicitamente marcado; histórico do gráfico exige série real.

## Validação
- `npm run check`: OK.
- `npm test`: OK, 16 arquivos de teste, 0 falhas.

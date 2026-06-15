# 2026-06-14 — Retorno IFIX/IDIV/SMLL com Yahoo range compatibility

## Causa auditada
- O APK envia `historyMonths=120` para o contrato `/api/v1/portfolio/returns`.
- Isso fazia o Proxy converter a janela dos benchmarks para `MAX`, usando Yahoo Chart `range=10y&interval=1mo`.
- Para `IFIX.SA`, `IDIV.SA` e `SMLL.SA`, essa janela ampla pode não devolver pontos suficientes, embora o endpoint direto confirmado `range=1d&interval=1d` esteja disponível.
- Sem pelo menos 2 pontos reais, o contrato retornava benchmark vazio e o APK mostrava os índices como indisponíveis.

## Correção aplicada
- `IFIX`, `IDIV` e `SMLL` continuam usando símbolos diretos do índice no Yahoo Finance: `IFIX.SA`, `IDIV.SA`, `SMLL.SA`.
- Antes de marcar o índice como vazio, o Proxy agora tenta janelas Yahoo compatíveis: `5y/1wk`, `2y/1d`, `1y/1d`, `6mo/1d`, `3mo/1d`, `1mo/1d`, `5d/1d` e `1d/1d`.
- B3 daily-evolution e Investidor10 permanecem como fallbacks reais.
- Nenhum ETF, proxyTicker, ticker falso ou série simulada foi usado.

## Validação
- Adicionado teste `portfolio-returns-yahoo-index-compatible-ranges.test.js`, cobrindo o caso em que `10y/1mo` não devolve pontos e o Proxy recupera a série por janelas Yahoo compatíveis.

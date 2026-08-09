# CHECKPOINT V216 — Modal único de ações: indicadores fundamentalistas

Data: 2026-07-03

## Escopo
- Evolui `/api/v1/asset/stock-modal` para `26.asset-modal.stock.v2`.
- Adiciona `fundamentalIndicators` ao contrato do modal único de ações.
- Implementa a seção conforme a referência visual PETR4/Investidor10: título, subtítulo, seletor `Sem comparativos`, modos `grid/list` e cards de indicadores.

## Campos do contrato
- `fundamentalIndicators.items`: lista plana preservando a ordem do Investidor10.
- `fundamentalIndicators.groups`: agrupamentos mobile-first por valuation, margens, rentabilidade, endividamento e crescimento.
- `fundamentalIndicators.comparator`: estado inicial `Sem comparativos`.
- `fundamentalIndicators.displayModes`: `grid` e `list` para alternância no APK.

## Indicadores cobertos
P/L, P/receita (PSR), P/VP, Dividend Yield, Payout, Margem Líquida, Margem Bruta, Margem Ebit, Margem Ebitda, EV/Ebitda, EV/Ebit, P/Ebitda, P/Ebit, P/Ativo, P/Cap.Giro, P/Ativo Circ. Liq., VPA, LPA, Giro Ativos, ROE, ROIC, ROA, Dívida Líquida/Patrimônio, Dívida Líquida/Ebitda, Dívida Líquida/Ebit, Dívida Bruta/Patrimônio, Patrimônio/Ativos, Passivos/Ativos, Liquidez Corrente, CAGR Receitas 5 anos e CAGR Lucros 5 anos.

## Validação
- `node --check lib/analysis/stock-modal-contract.js`
- `node test/stock-modal-contract-v215.test.js`

# Checkpoint v209 — Correção Dividend Yield/Dividendos no modal de FIIs

Release: 21.12.239-fii-dividend-charts-fix-v209
Contrato: 26.asset-modal.fii.v17

## Correções
- Corrigida a captura da tabela visível `{TICKER} DIVIDENDOS` do Investidor10.
- Adicionado fallback direto pelo HTML visível para as seções `DIVIDEND YIELD {TICKER}` e `{TICKER} DIVIDENDOS`.
- O Proxy agora monta eventos, séries mensais, séries anuais e série derivada de Dividend Yield quando o gráfico dinâmico não vem no JSON/API.
- Corrigida a leitura da data de pagamento em `investidor10-chart-extractor.js`, que antes podia capturar o dia da Data Com no lugar do pagamento.

## Validação
- `node --check lib/analysis/fii-modal-contract.js`
- `node --check lib/market/investidor10-chart-extractor.js`
- `node test/fii-modal-dividend-html-fallback-v209.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

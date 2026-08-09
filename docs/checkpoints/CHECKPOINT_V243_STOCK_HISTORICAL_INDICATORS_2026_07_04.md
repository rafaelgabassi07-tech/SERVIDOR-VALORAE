# Proxy v243 — Histórico de indicadores fundamentalistas de ações

## Escopo
Corrigir o modal único de ação para consumir corretamente o bloco **Histórico de Indicadores Fundamentalistas** do Investidor10.

## Alterações
- Contrato de ação atualizado para `26.asset-modal.stock.v24`.
- Parser de histórico de ações aceita tabelas 5A/10A reais com `columns/data`, `rows/linhas`, `categories/series` e objetos por indicador.
- Normalização das colunas `Atual` e anos, mantendo a ordem do Investidor10.
- Normalização dos indicadores públicos exibidos na tela do PETR4/Investidor10, incluindo P/L, P/Receita, P/VP, Dividend Yield, Payout, margens, EV, VPA, LPA, ROE, ROIC, ROA, dívidas, estrutura e CAGR.
- Sem fallback estático, sem PETR4/GGRC11 fixo e sem simulação de valores.

## Validação
- `node --check lib/analysis/stock-modal-contract.js`
- `node test/stock-modal-contract-v215.test.js`
- `node test/stock-modal-historical-indicators-investidor10-v243.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

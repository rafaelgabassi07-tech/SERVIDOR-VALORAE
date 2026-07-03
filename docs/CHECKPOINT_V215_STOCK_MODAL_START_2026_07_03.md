# Checkpoint v215 — Modal único de ações: início por PETR4

Proxy patch: `21.12.245-stock-modal-start-v215`
Contrato: `26.asset-modal.stock.v1`
Data: 2026-07-03

## Implementado

- Criado endpoint `/api/v1/asset/stock-modal` para iniciar a montagem do modal único de ações.
- Adicionados aliases `/api/v1/asset/action-modal` e `/api/v1/acao/modal`.
- O contrato de ações entrega, para PETR4 e demais ações B3:
  - cards rápidos: Cotação, Variação 12M, P/L, P/VP e DY;
  - gráfico de cotação intradiária via Yahoo Finance Chart API;
  - tabela Rentabilidade nominal/real nos períodos 1 mês, 3 meses, 1 ano, 2 anos, 5 anos e 10 anos;
  - fallback defensivo de rentabilidade com Yahoo + IPCA Banco Central quando o HTML estático do Investidor10 não trouxer a tabela.
- O endpoint rejeita FIIs com `status: NOT_STOCK`, preservando a separação com `/api/v1/asset/fii-modal`.

## Validações

- `node --check lib/analysis/stock-modal-contract.js`
- `node --check routes/_router.js`
- `node test/stock-modal-contract-v215.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

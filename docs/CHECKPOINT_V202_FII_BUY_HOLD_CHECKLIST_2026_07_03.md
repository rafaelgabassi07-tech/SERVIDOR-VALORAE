# Checkpoint v202 — Checklist Buy and Hold no modal de FIIs

Data: 2026-07-03  
Contrato: `26.asset-modal.fii.v10`  
Patch: `21.12.232-fii-buy-hold-checklist-v202`

## Implementado

- Novo objeto `checklist` em `/api/v1/asset/fii-modal`.
- Parser dedicado para a seção `CHECKLIST DO INVESTIDOR BUY AND HOLD SOBRE {TICKER}` do Investidor10.
- Critérios mapeados para FIIs, incluindo:
  - Mais de 5 anos listado em Bolsa.
  - Dividend Yield médio dos últimos 5 anos acima de 8%.
  - Liquidez média diária acima de R$ 700 mil.
  - Número de cotistas acima de 20 mil.
  - Patrimônio líquido acima de R$ 1 bilhão.
  - 5 ou mais imóveis no portfólio.
  - Vacância física média dos últimos 12 meses abaixo de 10%.
  - Vacância financeira média dos últimos 12 meses abaixo de 10%.
- O contrato retorna contadores `total`, `passed`, `failed` e `unknown`.
- O contrato preserva o aviso informativo do Investidor10 quando encontrado.

## Validação

- `node --check lib/analysis/fii-modal-contract.js`
- `node test/fii-modal-buy-hold-checklist-v202.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

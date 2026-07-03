# Checkpoint v204 — Dividend Yield e Dividendos no modal de FIIs

Data: 2026-07-03
Contrato: `26.asset-modal.fii.v12`

## Implementado

- Novo objeto `dividendCharts` no contrato `/api/v1/asset/fii-modal`.
- Séries de **Dividend Yield** por frequência: `monthly` e `yearly`.
- Séries de **Dividendos** por frequência: `monthly` e `yearly`.
- Opções de frequência **Mensal/Anual**.
- Opções de período **1A/5A/MAX**.
- Cards `currentDyDisplay` e `averageDy5yDisplay`.
- Resumo `summary` com total pago nos últimos 12 meses.
- Eventos da tabela com `type`, `dataComDisplay`, `paymentDateDisplay` e `valueDisplay`.

## Política de fonte

A fonte primária é Investidor10. Quando a série visual de DY não estiver exposta no HTML/API, o Proxy tenta derivar a leitura a partir dos dividendos do próprio Investidor10 e preço de referência disponível, sinalizando isso em `diagnostics.dyDerivedFromDividends`.

## Validações

- `node --check lib/analysis/fii-modal-contract.js`
- `npm run check:syntax`
- `node test/fii-modal-dividend-charts-v204.test.js`
- `npm test`
- `npm run audit:version`

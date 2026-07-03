# VALORAE Proxy — v203 — Distribuições 12M no modal de FIIs

Core version: 21.12.0  
Public version: 21.12.233  
Patch: `21.12.233-fii-distributions12m-v203`  
Checkpoint: `fii-distributions12m-v203`

Proxy v203 acompanha o APK v322: o modal único de FIIs passa a receber o bloco **Distribuições nos últimos 12 meses** do Investidor10, incluindo Yield 1M/3M/6M/12M e valor pago por cota.

## Escopo

- Contrato `/api/v1/asset/fii-modal` evoluído para `26.asset-modal.fii.v11`.
- Novo objeto `distributions12m` no contrato de FII.
- Parser dedicado e fallback HTML para a seção `DISTRIBUIÇÕES NOS ÚLTIMOS 12 MESES`.
- Mantidos os blocos anteriores: cotação Yahoo, comparação com índices, comparador com outros FIIs, checklist Buy and Hold, rentabilidade, informações cadastrais e histórico de indicadores.

## Validação

- `node --check lib/analysis/fii-modal-contract.js`
- `node test/fii-modal-distributions12m-v203.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`


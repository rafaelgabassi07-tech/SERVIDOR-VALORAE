# Checkpoint v196 — FII modal Yahoo indices

Data: 2026-07-03
Proxy public version: 21.12.226
Release patch: 21.12.226-fii-modal-yahoo-indices-v196
Contrato FII modal: 26.asset-modal.fii.v4

## Implementado

- Comparação de FIIs com IFIX, IDIV e SMLL por Yahoo Finance Chart API.
- Períodos 2A, 5A e 10A com séries normalizadas de retorno acumulado.
- Cards de cotações dos índices via símbolos diretos IFIX.SA, IDIV.SA e SMLL.SA.
- Correção dos cards superiores do modal de FII, inclusive preservando variações negativas.
- Fallbacks seguros para cotação, DY 12M, P/VP, liquidez diária e variação 12M.

## Validação

- node --check lib/analysis/fii-modal-contract.js
- node --check routes/_router.js
- node test/fii-modal-yahoo-comparison-v196.test.js
- node test/fii-modal-historical-indicators-v194.test.js
- node test/fii-modal-investidor10-info-v193.test.js
- node test/fii-modal-contract-v192.test.js

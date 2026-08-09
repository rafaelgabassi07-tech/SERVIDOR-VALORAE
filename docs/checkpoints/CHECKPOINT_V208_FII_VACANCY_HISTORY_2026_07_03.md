# Checkpoint v208 — Histórico da taxa de vacância

Release: 21.12.238-fii-vacancy-history-v208
Data: 2026-07-03

## Contrato
- `26.asset-modal.fii.v16`
- Novo objeto `vacancyHistory` no modal único de FII.

## Implementação
- Parser para o bloco **HISTÓRICO DA TAXA DE VACÂNCIA** do Investidor10.
- Tentativas em endpoints candidatos de vacância do Investidor10.
- Fallback via histórico de indicadores quando houver dados de vacância disponíveis.
- Pontos com `vacancyPercent`, `vacancyDisplay`, `occupancyPercent`, `occupancyDisplay`, `periodKey`, `label`, `year` e `month`.

## Teste dedicado
- `node test/fii-modal-vacancy-history-v208.test.js`

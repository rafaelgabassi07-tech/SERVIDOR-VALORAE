# Checkpoint 348 — Portfolio price chart integrity v316

Pareamento: APK v479 / protocolo móvel `2026.07.10.9`.

## Correções

- O ponto oficial `currentPrice` é anexado após a estabilização das bordas remotas.
- A cotação atual não pode mais ser descartada como pico artificial.
- Históricos importados incompletos inferem estoque inicial pela posição atual e saldo líquido dos lançamentos.
- Cotações anteriores à primeira transação conhecida são preservadas quando a posição já existia.
- O contrato expõe cobertura por ticker e posições reconciliadas.

## Validação

- `portfolio-price-chart-integrity-v316.test.js`.
- Testes históricos do motor `portfolio/history`.
- `npm run verify`.
- Testes cruzados com APK checkpoint69.
- Extração limpa e nova execução das suítes.

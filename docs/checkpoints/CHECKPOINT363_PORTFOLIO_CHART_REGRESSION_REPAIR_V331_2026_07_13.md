# Checkpoint 363 — Portfolio chart regression repair v331

## Pareamento

- Proxy: `21.12.363-portfolio-chart-regression-repair-v331`
- APK: `v511 / 2026.07.13.07 / Checkpoint 101`
- Protocolo móvel: `2026.07.10.10`

## Correções

O Yahoo identifica candles mensais pelo início do mês, embora o `close` seja do fechamento. O motor anterior filtrava a série e reconstruía a posição usando esse timestamp inicial; uma compra em 15 de janeiro, por exemplo, não participava do fechamento de janeiro. `portfolioBucketEndTimestampSeconds` separa o rótulo visual do timestamp usado para o estado da carteira.

Quando a quantidade atual é maior que o saldo líquido das transações conhecidas, existe estoque de abertura. Nessa situação, uma data igual ou posterior à primeira transação importada não é usada para cortar a série; somente uma data explicitamente anterior limita o histórico.

## Testes

- `test/portfolio-history-monthly-close-composition-v331.test.js`
- `test/portfolio-rebuild-v292.test.js`
- `test/portfolio-price-chart-integrity-v316.test.js`
- `npm run build`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`
- `npm run test:cross-stack`

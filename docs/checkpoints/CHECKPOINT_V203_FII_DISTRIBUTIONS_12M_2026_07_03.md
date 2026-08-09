# Checkpoint v203 — Distribuições 12M no modal de FIIs

## Resumo

Implementa no contrato `/api/v1/asset/fii-modal` o bloco `distributions12m`, baseado na seção do Investidor10 “Distribuições nos últimos 12 meses”.

## Implementado

- Contrato de FII evoluído para `26.asset-modal.fii.v11`.
- Novo bloco `distributions12m` com Yield 1 mês, 3 meses, 6 meses e 12 meses.
- Cada item inclui percentual de yield, valor em reais pago por cota, rótulo e fonte.
- Parser usa primeiro `canonical.fii.distribution12m` e mantém fallback HTML direto da seção enviada.
- Diagnóstico de quantidade de linhas canônicas/HTML retornadas.

## Validação

- `node --check lib/analysis/fii-modal-contract.js`
- `node test/fii-modal-distributions12m-v203.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

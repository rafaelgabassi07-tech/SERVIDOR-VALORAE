# VALORAE Proxy — Deduplicação da agenda de proventos

Data: 2026-06-13

## Objetivo

Reforçar o contrato `/api/v1/dividends/batch` para remover duplicidades antes de responder ao APK.

## Alterações

- Chaves de deduplicação agora normalizam datas em formatos diferentes antes de comparar eventos.
- Datas de pagamento e data-com/data-base passam a ser comparadas de forma canônica.
- Tipo de provento passa por agrupamento por família: JCP, dividendo, rendimento, amortização ou provento.
- Valor por ação/cota é normalizado com precisão estável para reduzir divergências entre fontes.
- O Proxy adiciona diagnóstico `valorae-dedupe` quando remove eventos duplicados das fontes.

## Arquivo alterado

- `lib/portfolio/dividends-contract.js`

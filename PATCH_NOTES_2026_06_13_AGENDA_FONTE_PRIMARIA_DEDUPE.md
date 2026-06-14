# VALORAE Proxy — Fonte primária e deduplicação forte da agenda

Data: 2026-06-13

## Fonte da agenda

A agenda de proventos usa duas fontes:

1. StatusInvest por ativo, como fonte primária de proventos confirmados.
2. Investidor10 calendário, como complemento para calendário público de pagamentos.

## Regra anti-duplicidade

- Mesmo ticker + mesma data de pagamento + mesma família de provento agora é uma única linha.
- StatusInvest tem prioridade quando houver conflito de valor com Investidor10.
- Investidor10 continua habilitado apenas como complemento de calendário, sem criar linha duplicada quando o StatusInvest já confirmou o evento.
- Foi adicionado diagnóstico `valorae-dedupe` com a política de fonte e número de duplicidades removidas.

## Teste adicionado

- `test/dividend-dedupe-btci11.test.js` cobre o caso BTCI11 com duas fontes e valor por cota ligeiramente diferente.

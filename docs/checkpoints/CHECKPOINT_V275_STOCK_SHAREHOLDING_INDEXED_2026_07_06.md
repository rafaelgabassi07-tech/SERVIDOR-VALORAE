# Checkpoint Proxy v275 — Posição acionária indexada

Patch: `21.12.304-stock-shareholding-indexed-v275`

## Correção

O parser de `shareholdingPosition` passou a aceitar respostas tabulares/indexadas do Investidor10, incluindo `columns` com objetos `data/title` e linhas `data` com chaves numéricas `0`, `1`, `2` e `3`.

## Segurança de dados

A validação estrita continua rejeitando indicadores, notícias, comentários e texto livre como acionistas. Não há fallback estático.

## Validação

- `node test/stock-modal-shareholding-indexed-rows-v275.test.js`
- `node test/stock-modal-shareholding-strict-i10-v264.test.js`
- `node test/stock-modal-revenue-region-shareholding-i10-v263.test.js`

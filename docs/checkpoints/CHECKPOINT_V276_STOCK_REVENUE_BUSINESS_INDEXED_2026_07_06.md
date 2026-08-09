# Checkpoint v276 — Negócios que geram receita indexado/DataTables

Patch: `21.12.305-stock-revenue-business-indexed-v276`  
Contrato: `26.asset-modal.stock.v51`  
Data: 2026-07-06

## Escopo

Corrige o checkpoint 4 da investigação atual: **Negócios que geram receita** no modal de ação.

## Ajustes

- Normalização de `columns` + `data`/`rows` para Regiões e Negócios de receita.
- Suporte a linhas indexadas como `{0: "Diesel", 1: "R$ 38,36 Bilhões", 2: "30%"}`.
- Suporte a colunas `{data,title}` com títulos como Negócio, Receita e Participação.
- Aliases inline adicionais do Investidor10 para gráficos de negócios de receita.
- Mantido filtro estrito contra indicadores, metadados financeiros, notícias e textos livres.

## Validação

- `node test/stock-modal-revenue-business-indexed-rows-v276.test.js`
- `node test/stock-modal-revenue-business-i10-v251.test.js`
- `node test/stock-modal-revenue-region-i10-v250.test.js`
- `npm test`

# Checkpoint v268 — Stock modal data integrity

Patch: `21.12.297-stock-modal-data-integrity-v268`  
Data: 2026-07-06

## Escopo

Correção incremental do modal de Ação após auditoria visual e funcional:

1. Posição acionária deve vir apenas do bloco oficial do ativo pesquisado.
2. Dados fundamentalistas, mercado, notícias e textos livres não podem ser aceitos como acionistas.
3. Histórico de indicadores fundamentalistas deve aceitar formatos alternativos retornados por diferentes tickers.

## Alterações

- `buildStockShareholdingPayload` passou a usar seção textual delimitada e JSON/tabelas específicas.
- Removido fallback de varredura da página inteira para posição acionária.
- Ampliado `looksLikeInvalidShareholderLabel` para bloquear indicadores e ruídos recorrentes.
- Ampliados endpoints/aliases de histórico fundamentalista em `fetchInvestidor10StockApiExtras` e `buildStockHistoricalIndicatorSources`.
- Diagnóstico inclui `discardedRows` e política explícita de captura estrita.

## Validação

- `node test/stock-modal-data-integrity-v268.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`
- `npm run build`

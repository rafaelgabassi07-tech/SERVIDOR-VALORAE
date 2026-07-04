# Proxy v235 — Auditoria e otimização da Análise/busca

Patch: `21.12.265-analysis-search-audit-v235`
Data: 2026-07-04

## Escopo

Correção comportamental do endpoint de sugestões usado pela página Análise do APK.

## Ajustes

- Novo detector `isSuggestionRequest()` em `routes/assets.js`.
- Quando `suggest=true`, `searchMode=analysis`, `suggestions=true` ou modo autocomplete estiver ativo, a rota retorna catálogo de sugestões leve.
- Ticker exato em modo sugestão deixa de acionar batch pesado do motor de ativos.
- `searchPolicy` atualizado para `analysis_intelligent_search_v235`.
- `debounceRecommendedMs` ajustado para 320ms.

## Validação

- `node --check routes/assets.js`
- `node test/router-assets-contract-v115.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

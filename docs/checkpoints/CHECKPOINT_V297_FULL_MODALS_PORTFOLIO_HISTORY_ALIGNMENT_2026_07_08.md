# Checkpoint v297 — Full modals + portfolio history alignment

Data: 2026-07-08
Patch: `21.12.326-full-modal-portfolio-history-alignment-v297`
Par APK: `apk_valorae_checkpoint41_full_modals_portfolio_history_alignment_v451_AI_STUDIO_ROOT_OK_2026_07_08.zip`

## Resultado

O Proxy fica alinhado ao APK v451: modais de Ação/FII não retornam mais payload leve/PARTIAL por deadline e o histórico de carteira passa a respeitar transações completas, incluindo ativos históricos ou vendidos enquanto existiam na carteira.

## Mudanças

- `lib/analysis/asset-modal-runtime.js`: runtime dos modais em modo full-only, sem fallback PARTIAL de deadline.
- `lib/analysis/stock-modal-contract.js`: wrapper força contrato full e orçamento de fonte completo.
- `lib/analysis/fii-modal-contract.js`: wrapper força contrato full e orçamento de fonte completo.
- `lib/portfolio/history.js`: aceita JSON string em `positions[]`/`transactions[]`, reconstrói ativos históricos, usa preço remoto para ancorar posição viva e expõe `activeTickers`, `historyTickers` e `transactionOnlyTickers`.
- `routes/_router.js` e `routes/portfolio/history.js`: `/portfolio/history` aceita transações como origem suficiente para montar histórico.

## Validação

- `node test/asset-modal-runtime-deadline-v295.test.js`
- `node test/asset-modal-quality-cache-v296.test.js`
- `node test/modal-runtime-freshness-v267.test.js`
- `node test/portfolio-rebuild-v292.test.js`
- `node test/portfolio-active-history-v293.test.js`
- `node test/portfolio-query-contract-v294.test.js`
- `npm run build`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

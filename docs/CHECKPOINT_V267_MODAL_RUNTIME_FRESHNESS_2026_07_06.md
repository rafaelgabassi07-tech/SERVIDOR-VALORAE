# Checkpoint Proxy v267 — Runtime fresco dos modais

Patch: `21.12.296-modal-runtime-freshness-v267`  
Contratos: `26.asset-modal.stock.v46 / 26.asset-modal.fii.v22 / 26.asset-modal.runtime.v3`

## Auditoria

- O runtime v266 já separava produtores de Ação/FII e fazia cache/coalescing.
- A nova rodada identificou que cache `STALE` podia ser entregue diretamente após expiração do TTL fresco.
- Para modais, isso aumenta risco de dado antigo parecer atual em reaberturas sucessivas.

## Implementação

- `withAssetModalRuntime` agora consulta cache fresco primeiro.
- Cache stale passa a ser guardado apenas como fallback.
- Após o TTL fresco, o produtor real é executado antes de responder.
- Se a renovação falhar, o contrato stale é retornado com `cacheStatus: STALE_FALLBACK` e `fallbackReason`.
- Diagnóstico público do runtime deixa de expor a chave interna de cache.

## Validação

- `node --check lib/analysis/asset-modal-runtime.js`
- `node test/modal-runtime-freshness-v267.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

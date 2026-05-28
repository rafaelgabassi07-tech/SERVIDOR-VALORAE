# VALORAE v21.12.0 — otimização profunda de Scraper/API

Esta versão implementa as fases prioritárias do plano profundo de otimização do VALORAE, mantendo a arquitetura free-only para GitHub/Vercel e preservando `lib/Valorae-engine.js` como núcleo central.

## Implementado

- Cache HTML com chave segura por URL normalizada, provider, `maxChars`, retorno HTML, scripts e headers relevantes.
- Proteção contra cache contaminado por HTML truncado.
- Cache final de resultado para `/api/scrape` e `/api/batch-scrape` usando `TtlLruCache` existente.
- Normalização central em `lib/scrape/scrape-input.js`.
- Separação de `fetchKey` e `resultKey`.
- Batch coalescido por URL/fetchKey, com subgrupos por assinatura de resultado.
- Fast-path conservador para seletores simples em `lib/scrape/fast-selectors.js`.
- Fallback automático para `extractCustomSelectors` quando o seletor é complexo.
- Métricas detalhadas de scraping em `lib/performance/scrape-metrics.js`.
- In-flight dedupe genérico em `lib/resilience/inflight.js`.
- Payload mobile com `compact=1`, `previewChars` e compatibilidade com `fields=` já existente no contrato HTTP.
- Benchmark local/mockado em `scripts/benchmark-scrape.js`.

## Novos campos de `/api/scrape`

- `cacheLayers`
- `metrics.routeTimeMs`
- `metrics.fetchTimeMs`
- `metrics.parseTimeMs`
- `metrics.selectorTimeMs`
- `metrics.serializeTimeMs`
- `metrics.htmlSizeKb`
- `metrics.nodesFound`
- `metrics.selectorCount`
- `metrics.resultKeys`
- `metrics.parseStrategy`
- `metrics.cacheStatus`
- `limits.maxSelectors`
- `limits.maxPerSelector`
- `limits.maxHtmlChars`
- `limits.truncated`
- `limits.returnedHtml`
- `limits.previewChars`

## Novos campos de `/api/batch-scrape`

- `coalesced`
- `resultCacheHits`
- `resultCacheMisses`
- `htmlCacheHits`
- `networkFetches`
- `batchMetrics.fetchGroups`
- `batchMetrics.resultGroups`
- `batchMetrics.parseRuns`
- `batchMetrics.selectorRuns`
- `batchMetrics.maxGroupSize`
- `batchMetrics.coalescedByUrl`
- `batchMetrics.coalescedByResult`

## Comandos

```bash
npm run check
npm test
npm run build
npm run smoke
npm run audit:scrape-optimization
npm run bench:scrape
```

## Limitações preservadas

- Métricas e caches são em memória por instância serverless.
- Não há Redis, banco, KV, WebSocket, cron ou serviço pago obrigatório.
- O fast-path só atua em seletores simples e seguros; seletores complexos continuam no extrator robusto.

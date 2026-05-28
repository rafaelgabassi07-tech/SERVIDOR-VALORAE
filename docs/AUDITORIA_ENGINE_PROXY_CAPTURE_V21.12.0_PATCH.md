# Auditoria Valorae Engine / Proxy Capture — v21.12.0 patch

## Objetivo
Garantir que o Proxy Valorae continue usando `lib/Valorae-engine.js` como núcleo central, captando o tráfego real das rotas `/api/*`, medindo respostas JSON e respostas diretas/streaming, e expondo dados prontos para painéis, gráficos, métricas e consumo pelo APK/web.

## Pontos auditados
- `api/router.js`: entrada serverless única para Vercel Free.
- `routes/_router.js`: resolução de `/api`, `/api/v1/*`, `/api/v2/*`, aliases legados e rotas operacionais.
- `lib/Valorae-engine.js`: montagem de payload de ativos, métricas, qualidade, normalização, readiness e cache.
- `lib/observability/server-metrics.js`: interceptação de tráfego real, isolamento de polling interno e snapshots para dashboards.
- `routes/server/metrics.js`, `routes/server/tests.js`, `routes/cache/stats.js`, `routes/source/status.js`, `routes/deploy/status.js`: endpoints críticos para painel e diagnóstico.
- `public/server.html`: centro visual único de métricas/testes.

## Correções e melhorias aplicadas

### 1. Captura mais profunda do Proxy
Antes, a interceptação profunda media `sendJson` e `res.end`. Agora ela também contabiliza respostas que usam `res.write` antes do `res.end`, evitando perda de bytes/chunks em rotas que façam streaming, arquivos dinâmicos ou respostas diretas.

Campos adicionados ao snapshot de métricas:
- `summary.captureCompletenessPercent`
- `summary.directResponsesCaptured`
- `summary.streamedWriteChunks`
- `summary.streamedWriteBytes`
- `totals.writeChunks`
- `totals.writeBytes`
- `totals.directResponses`

Também foi adicionado `contentType` nos eventos recentes para ajudar o painel a diferenciar JSON, texto, HTML e respostas diretas.

### 2. Readiness operacional mais fiel
A seção `readiness` agora inclui:
- medição explícita `res.end/write`;
- completude de captura;
- contagem de chunks de streaming.

Isso melhora a confiança de que o painel está lendo o que passa pelo proxy, sem confundir polling interno com tráfego real.

### 3. Gráficos normalizados direto no Engine
O payload de ativo agora inclui `chartSeries`, construído por `buildNormalizedChartSeries`, além de `chartReadiness`.

Isso facilita para o APK/web montar gráficos sem precisar reprocessar todo o JSON bruto. O engine agora entrega:
- séries ordenadas por quantidade de pontos;
- pontos `{ x, y, label, raw }`;
- `summary` por série com mínimo, máximo, primeiro, último e variação percentual;
- limite configurável por `maxChartSeries` ou `chartSeriesLimit`.

### 4. Compatibilidade mantida
Foram preservados:
- arquivo central `lib/Valorae-engine.js`;
- compatibilidade com Vercel Free;
- router físico único `api/router.js`;
- isolamento de `/api/server/metrics`, `/api/server/tests`, `/api/cache/stats`, `/api/source/status` etc.;
- contrato atual de respostas e testes existentes.

## Validações executadas

Comandos executados com sucesso:

```bash
npm run check
npm test
npm run audit:vercel-api
npm run audit:dashboard-live
npm run audit:live-endpoints
npm run build
npm run audit:single-app
```

Também foi feito smoke test local em `server.js` validando:
- `/api/health`
- `/api/server/metrics`
- `/api/server/tests?mode=quick`
- `/api/cache/stats`

Resultado: endpoints críticos retornaram JSON válido; `server/metrics` retornou `summary`; `server/tests` retornou `benchmark`; `cache/stats` retornou `caches`.

## Arquivos alterados
- `lib/Valorae-engine.js`
- `lib/observability/server-metrics.js`
- `docs/AUDITORIA_ENGINE_PROXY_CAPTURE_V21.12.0_PATCH.md`

## Observações importantes
- As métricas continuam em memória por instância serverless; isso é correto para manter Vercel Free sem banco externo, Redis, KV, WebSocket ou cron.
- Polling do painel e rotas internas continuam isolados para não inflar gráficos de tráfego real.
- Para o APK consumir melhor os gráficos, prefira ler `chartSeries` e `chartReadiness` antes de tentar montar gráficos a partir de campos soltos em `results`.

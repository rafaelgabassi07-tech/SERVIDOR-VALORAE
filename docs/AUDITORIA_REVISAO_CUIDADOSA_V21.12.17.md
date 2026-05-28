# Auditoria cuidadosa v21.12.17 — Vercel Runtime e painel servidor

## Objetivo

Revisar a sequência de melhorias aplicada ao Valorae Proxy Server e corrigir pontos que ainda impediam o painel web de refletir corretamente o que passa pelo proxy, especialmente em deploy Vercel e no próprio botão de consulta do painel.

## Achados principais

### 1. Polling interno isolava corretamente os contadores, mas escondia contexto Vercel

`/api/server/metrics` precisa ser ignorado pelos contadores de tráfego real para não inflar gráficos. Porém, como essa rota também era ignorada completamente, host, região, país e `x-vercel-id` da Vercel só apareciam depois de tráfego externo real. Em deploy novo, o painel podia ficar com Vercel Runtime aparentemente `local` ou vazio.

Correção: a telemetria interna agora mantém mapas próprios de Vercel Runtime (`internalTelemetry.vercelRegions`, `vercelHosts`, `vercelCountries`) sem somar em `summary.requests`, `routeDetails` ou eventos externos.

### 2. A consulta do próprio dashboard era marcada como telemetria interna

O helper `api()` enviava `x-valorae-telemetry: dashboard` em todas as chamadas. Isso era correto para polling de métricas, mas errado para consultas reais como `/api/asset`, pois fazia o proxy ignorar a chamada e ela não aparecia nos gráficos/eventos.

Correção: o dashboard agora usa `telemetryHeaders(path)`. Rotas operacionais continuam internas; rotas de dados usam `x-valorae-channel: dashboard-probe` e são captadas normalmente.

## Contrato preservado

- `Valorae-engine.js` continua como núcleo central.
- A versão pública do engine permanece `21.12.0` para compatibilidade com testes e contratos existentes.
- A versão interna da telemetria de servidor passa para `21.12.17-careful-review-vercel-runtime`.
- Sem dependências pagas, banco externo, KV, Redis, WebSocket ou cron obrigatório.

## Validações

- `npm run check`
- `node test/careful-review-vercel-runtime-v21-12-17.test.js`
- `npm test`
- auditorias Vercel/dashboard/live/single-app/free
- build e smoke test

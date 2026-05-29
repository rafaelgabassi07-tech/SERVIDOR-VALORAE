# Auditoria v21.12.32 — Launch Performance Optimizer

## Objetivo

Aprimorar o ecossistema `Valorae-engine.js` para lançamento pessoal ainda hoje, com foco em eficiência, performance, confiabilidade, precisão e sincronização total com Web/APK e Monitor Proxy.

## Implementações principais

- `engineRuntimeProfiler`: profiler por etapa do Engine.
  - mede `source.investidor10`, `source.statusinvest`, APIs internas, Yahoo fallback, enriquecimento, notícias, montagem base, contratos, guardrails e aplicação de view.
  - gera score, grade, gargalos e recomendações práticas.

- `engineLaunchGate`: gate final por resposta.
  - consolida maturidade, runtime, integridade, consistência, orçamento de payload, cobertura e plano de ação.
  - retorna decisão simples: `release_to_app`, `release_controlled_with_monitoring`, `render_partial_with_banner`, `render_readonly_keep_cache` ou `hold_previous_snapshot`.

- Novo endpoint `/api/v1/engine/performance`.
  - entrega profiler, gate, payloadBudget, maturity e integridade por ticker.
  - útil para validar PETR4, VALE3, ITUB4, HGLG11, MXRF11 etc. antes de liberar telas no app.

- `view=app` atualizado.
  - preserva `engineRuntimeProfiler` e `engineLaunchGate` em formato compacto.
  - mantém raízes oficiais do app: `appMobileSnapshot`, `appPayload`, `appSyncEnvelope`, `appResponseIntegrity`.

- Monitor/telemetria atualizados.
  - `proxyOutputMonitor.outputFeed[]` detecta runtime score, launch gate score, decisão do gate e readyForPersonalUse.
  - `VALORAE_SERVER_METRICS_VERSION = 21.12.32-launch-performance-monitor`.

## Arquivos alterados

- `lib/Valorae-engine.js`
- `lib/quality/engine-runtime-profiler.js`
- `lib/quality/engine-launch-gate.js`
- `lib/quality/app-official-view.js`
- `lib/observability/server-metrics.js`
- `routes/engine/performance.js`
- `routes/engine/maturity.js`
- `routes/_router.js`
- `routes/openapi.js`
- `routes/fields.js`
- `routes/integration/manifest.js`
- `README.md`
- `docs/CHANGELOG.md`
- `metadata.json`
- `package.json`
- `test/launch-performance-optimizer-v21-12-32.test.js`

## Política de compatibilidade

- O núcleo `lib/Valorae-engine.js` foi preservado como arquivo central.
- `VALORAE_ENGINE_VERSION` continua `21.12.0` para compatibilidade pública.
- O patch interno desta rodada é `21.12.32-launch-performance-optimizer`.
- Sem dependências pagas, Redis, KV, banco externo, cron pago ou WebSocket.

## Recomendação operacional

Para Web/APK:

1. Usar `/api/v1/asset?ticker=PETR4&view=app`.
2. Renderizar primeiro `appMobileSnapshot`.
3. Hidratar detalhes com `appPayload`.
4. Antes de substituir cache local, verificar:
   - `appResponseIntegrity.cacheSafe`
   - `assetActionPlan.releaseDecision`
   - `engineLaunchGate.decision`
5. Usar `/api/v1/engine/performance?ticker=PETR4&view=app` para auditar gargalos.


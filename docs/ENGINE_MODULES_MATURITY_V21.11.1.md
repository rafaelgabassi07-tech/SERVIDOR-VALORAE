# VALORAE Proxy v21.11.1 — Engine Modules Maturity

Esta versão aprofunda o núcleo do VALORAE Engine sem desmembrar `lib/Valorae-engine.js` e mantendo a arquitetura gratuita para GitHub/Vercel.

## Melhorias principais

- Cache HTML familiar: uma entrada HTML maior e segura pode atender pedidos menores da mesma URL/provider/headers sem novo fetch.
- Circuit breaker aprimorado: cada fonte agora possui score, janela rolling, erro médio, latência média, cooldown dinâmico e diagnóstico mais claro.
- Classificação de erros mais precisa: detecção ampliada de WAF, CAPTCHA, rate limit, manutenção e indisponibilidade de fonte.
- Precisão de extração chart-aware: o relatório de extração considera cobertura, campos numéricos, suspeitas e prontidão real para gráficos.
- Chart readiness dedicado: detecta séries de arrays/objetos, pontos numéricos, datas, tendência e recomendações para gráficos.
- Dashboard atualizado: Engine Core exibe HTML family hit e score de fontes.
- Service Worker atualizado para `v21-11-1`, mantendo `/api` fora do cache.

## Arquivos principais

- `lib/Valorae-engine.js`
- `lib/scrape/scrape-input.js`
- `lib/resilience/circuit-breaker.js`
- `lib/resilience/error-classifier.js`
- `lib/quality/chart-readiness.js`
- `lib/quality/extraction-precision.js`
- `lib/scrape/custom-selectors.js`
- `public/server.html`
- `public/service-worker.js`
- `test/engine-core-modules-v21-11-1.test.js`
- `scripts/audit-engine-modules-v21-11-1.js`

## Garantias preservadas

- Sem Redis, banco, KV, WebSocket, filas, cron ou dependências pagas.
- Sem dependências npm obrigatórias.
- Compatível com Vercel Free.
- `/api/server/metrics` continua isolado da telemetria real.
- O Service Worker não intercepta `/api`.
- `Valorae-engine.js` continua sendo o núcleo central.


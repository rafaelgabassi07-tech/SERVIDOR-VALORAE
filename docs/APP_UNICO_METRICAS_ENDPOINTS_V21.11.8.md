# VALORAE Proxy Server v21.11.8 — App único, métricas e endpoints Vercel

## Problema corrigido

O deploy publicado podia carregar o HTML do painel, mas deixar gráficos, métricas e dados em tempo real vazios quando funções serverless críticas não eram publicadas ou quando `public/server.html` era removido. Os sintomas eram:

- `/api/server/metrics` retornando 404;
- `/api/source/status` retornando 404;
- `/api/cache/stats` retornando 404;
- dashboard parecendo apenas um esqueleto, sem dados nos gráficos;
- página `/tests.html` funcionando como experiência separada.

## Correções aplicadas

- `public/server.html` e `public/index.html` agora representam a mesma experiência: **VALORAE Proxy Server**.
- `/tests` e `/inspector` servem o app principal.
- `/tests.html` e `/inspector.html` ficaram apenas como redirecionamento de compatibilidade para `/server.html#tests`.
- A página **Testes e benchmark** foi integrada dentro do menu lateral do app principal.
- Foram adicionadas functions físicas para evitar 404 no Vercel:
  - `api/server/metrics.js`
  - `api/server/tests.js`
  - `api/cache/stats.js`
  - `api/source/status.js`
  - `api/deploy/status.js`
  - aliases versionados v1/v2 para métricas, testes, cache e source.
- `scripts/build-vercel-safe.js` valida que o app principal, métricas e endpoints críticos existem antes do deploy.
- `lib/observability/server-metrics.js` isola `/api/server/tests`, `/api/cache/stats`, `/api/source/status`, `/api/deploy/status` e probes com `X-Valorae-Telemetry`.
- `routes/ready.js` reconhece as functions físicas críticas como prontidão correta do deploy.

## Como validar no Vercel

Após subir a v21.11.8, abra:

```txt
https://servidor-valorae.vercel.app/
```

No menu lateral, acesse **Testes e benchmark**. O painel deve testar:

- `/api/server/metrics`
- `/api/server/tests`
- `/api/cache/stats`
- `/api/source/status`
- `/api/ready`
- `/api/deploy/status`
- `/api/asset`
- `/api/assets`
- PWA e Service Worker

Todos os testes internos usam header de telemetria para não inflar métricas reais.

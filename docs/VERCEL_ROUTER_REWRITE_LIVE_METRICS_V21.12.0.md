# VALORAE Proxy Server v21.12.0 — Router único, métricas ao vivo e endpoints críticos

Esta versão corrige o cenário em que o app visual carregava, mas páginas, gráficos e métricas ficavam sem dados porque as rotas internas do Proxy retornavam `404` ou payload inesperado no Vercel.

## Causa corrigida

A consolidação anterior dependia de `api/[...path].js`. Em alguns deploys Vercel, as rotas aninhadas como `/api/server/metrics`, `/api/cache/stats`, `/api/source/status`, `/api/v1/ready` e `/api/deploy/status` não eram publicadas/capturadas corretamente, deixando a interface sem `summary`, sem benchmark e sem dados em tempo real.

## Nova arquitetura

O deploy agora usa uma única Function física:

```txt
api/router.js
```

E o `vercel.json` reescreve:

```txt
/api         → /api/router?path=
/api/:path* → /api/router?path=:path*
```

Todas as rotas continuam no roteador interno `routes/_router.js`, preservando o app único VALORAE Proxy Server e evitando o limite de Functions do Vercel Free/Hobby.

## Endpoints validados

- `/api/server/metrics` retorna `summary` para alimentar gráficos.
- `/api/server/tests?mode=quick` retorna `benchmark` para a central interna de testes.
- `/api/v1/ready` retorna `READY`.
- `/api/deploy/status` retorna bloco `build`.
- `/api/cache/stats` retorna `caches`.
- `/api/source/status` retorna `providers`.

## Guardrails

- Sem páginas paralelas ao app principal.
- `/tests.html` e `/inspector.html` apenas redirecionam para `/server.html#tests`.
- Service Worker continua sem cachear `/api`.
- `/api/server/metrics`, `/api/server/tests`, `/api/cache/stats`, `/api/source/status` e status/admin continuam isolados da telemetria real.
- Sem Redis, banco, KV, WebSocket, cron, filas ou dependências pagas.

# VALORAE Proxy v21.12.0 — Consolidação de API Routes no Vercel

## Motivo

A versão anterior passou a usar várias funções físicas em `api/` para tentar evitar 404 em rotas críticas. Isso aumentou a quantidade de Serverless Functions publicadas no Vercel e podia acionar o alerta/erro de consolidação de rotas, especialmente no plano gratuito/Hobby.

## Correção

A versão v21.12.0 volta para uma arquitetura consolidada:

```txt
api/router.js
```

Todas as rotas reais continuam existindo, mas são resolvidas pelo roteador interno:

```txt
routes/_router.js
```

Assim, `/api/server/metrics`, `/api/cache/stats`, `/api/source/status`, `/api/server/tests`, `/api/ready`, `/api/deploy/status`, `/api/asset`, `/api/assets`, `/api/scrape` e `/api/batch-scrape` passam pelo `api/router.js`.

## Benefícios

- Menos Functions físicas no deploy.
- Menor risco de limite do Vercel Free/Hobby.
- Menos cold starts espalhados.
- Mantém app único: `VALORAE Proxy Server`.
- Mantém testes e benchmark dentro do app principal.
- Mantém `/api/server/metrics` isolado da telemetria real.

## Guardrails adicionados

- `npm run audit:functions`
- `npm run audit:vercel-api`
- `npm run audit:dashboard-live`
- `npm run audit:live-endpoints`

O build seguro do Vercel também falha se detectar Functions físicas extras em `api/`.

## Validação esperada após deploy

Abra o app principal:

```txt
https://servidor-valorae.vercel.app/
```

No menu lateral, acesse **Testes e benchmark**. Os endpoints críticos devem aparecer como 200 OK:

```txt
/api/server/metrics
/api/server/tests
/api/cache/stats
/api/source/status
/api/ready
/api/deploy/status
/api/health
```

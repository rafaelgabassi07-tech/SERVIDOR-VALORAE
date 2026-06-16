# Kit de Integração VALORAE Proxy

Use este kit para conectar APK, Web App, backend terceiro ou automações ao VALORAE Proxy.

## URL base

```txt
https://servidor-valorae.vercel.app
```

## Endpoints principais

- `/api/health` — saúde do proxy.
- `/api/ready` — prontidão operacional.
- `/api/asset?ticker=PETR4` — ativo individual.
- `/api/assets?tickers=PETR4,VALE3,ITUB4` — múltiplos ativos.
- `/api/portfolio/analyze` — análise de carteira.
- `/api/market/rankings` — rankings de mercado.
- `/api/server/metrics` — métricas do servidor proxy.

## Boas práticas

- Use timeout de 8 a 15 segundos no app consumidor.
- Faça cache local no app consumidor para reduzir chamadas repetidas.
- Leia `status`, `sourceStatus`, `cacheStatus` e campos de erro antes de atualizar carteiras.
- Para APK Android, chame o proxy por HTTPS e trate falhas de rede com retry progressivo.

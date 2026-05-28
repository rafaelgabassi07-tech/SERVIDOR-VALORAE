# VALORAE Proxy Server v21.11.7 — App único, testes internos e benchmark integrado

Esta versão remove a experiência separada de teste/inspector como interface própria. O VALORAE Proxy Server passa a ser o único app visual do projeto.

## Decisão

- `/`, `/server` e `/server.html` apontam para o VALORAE Proxy Server.
- A antiga página separada `/tests.html` foi reduzida a compatibilidade/redirect para `/server.html#tests`.
- A antiga página separada `/inspector.html` foi reduzida a compatibilidade/redirect para `/server.html#tests`.
- O menu lateral ganhou a página interna **Testes e benchmark**.
- Os testes de rede, endpoints, benchmark sintético e inspector de API agora rodam dentro do dashboard principal.

## O que a página interna testa

- `/api/server/metrics`
- `/api/server/tests`
- `/api/health`
- `/api/ready`
- `/api/v1/ready`
- `/api/deploy/status`
- `/api/asset`
- `/api/assets`
- `/api/cache/stats`
- `/api/source/status`
- `/manifest.webmanifest`
- `/service-worker.js`

## Isolamento de telemetria

Os probes do dashboard usam o header:

```txt
X-Valorae-Telemetry: dashboard-test
```

Esse header é tratado como telemetria interna em `lib/observability/server-metrics.js`, evitando que testes do próprio painel inflem requisições, respostas, status HTTP, rotas, cache/fonte e clientes reais.

## Arquivos principais

- `public/server.html`
- `public/index.html`
- `public/tests.html`
- `public/inspector.html`
- `routes/server/tests.js`
- `api/server/tests.js`
- `lib/observability/server-metrics.js`
- `routes/_router.js`
- `server.js`
- `vercel.json`
- `scripts/audit-single-app-unification-v21-11-7.js`
- `scripts/audit-dashboard-live-contract-v21-11-7.js`

## Compatibilidade

O projeto continua free-only:

- sem Redis;
- sem banco;
- sem KV;
- sem WebSocket;
- sem cron;
- sem filas;
- sem dependências npm obrigatórias;
- sem serviços pagos.

# VALORAE Proxy v21.11.7 — Correção de dashboard sem métricas no Vercel

## Diagnóstico observado

No domínio público, o painel estático carregava uma versão nova do dashboard, mas `/api/server/metrics` retornava `404` e `/api/health` ainda retornava `21.5.13-mature-final-release-free`.

Isso indica deploy misto/desatualizado: a camada estática foi publicada ou cacheada em versão nova, mas as funções serverless da pasta `api/` continuaram antigas ou não foram publicadas no deploy mais recente.

## Impacto

O dashboard depende de `/api/server/metrics`. Quando essa rota não existe, os cards, gráficos, tabelas e leituras de requisições ficam vazios, dando a impressão de que o servidor é apenas um esqueleto.

## Correções aplicadas

- Adicionadas funções físicas explícitas:
  - `api/server/metrics.js`
  - `api/v1/server/metrics.js`
  - `api/v2/server/metrics.js`
  - `api/ready.js`
  - `api/v1/ready.js`
  - `api/v2/ready.js`
  - `api/deploy/status.js`
- `public/server.html` agora mostra diagnóstico útil quando `/api/server/metrics` falha, em vez de permanecer com skeletons.
- Criada página `/tests.html` com testes em tempo real de rede, endpoints, métricas, health, ready, deploy status e benchmark local do navegador.
- `scripts/build-vercel-safe.js` agora valida a presença dos endpoints críticos e da página de testes.
- Mantido `node scripts/build-vercel-safe.js` como build principal do Vercel.

## Como verificar após deploy

Abra:

```txt
https://servidor-valorae.vercel.app/tests.html
```

Critérios mínimos:

- `/api/server/metrics` deve retornar 200 JSON.
- `/api/health` deve mostrar versão 21.11.7.
- `/api/deploy/status` deve retornar 200 JSON.
- `/server.html` deve sair do estado de skeleton.

## Observação

O Service Worker continua sem cachear `/api`, então métricas em tempo real não devem congelar no navegador.

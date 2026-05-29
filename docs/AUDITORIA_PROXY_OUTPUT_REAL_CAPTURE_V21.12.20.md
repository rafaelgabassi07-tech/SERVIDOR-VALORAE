# Auditoria v21.12.20 — Captura real de saídas do proxy

## Problema corrigido

O painel-servidor conseguia mostrar saídas quando a própria página executava a busca de teste, mas podia esconder respostas reais de rotas de dados caso o cliente/app enviasse `x-valorae-telemetry: dashboard`, `test` ou `probe`.

Isso fazia o monitor parecer dependente da sonda interna, quando a intenção é espelhar tudo que sai do proxy para usuários/apps.

## Correção aplicada

- `shouldIgnoreMetrics()` agora isola somente rotas internas/administrativas:
  - `/api/server/metrics`
  - `/api/ready`
  - `/api/cache/stats`
  - `/api/openapi`
  - `/api/fields`
  - `/api/errors`
  - rotas admin/deploy/status equivalentes
- Rotas de dados continuam capturadas mesmo com headers de dashboard/test/probe:
  - `/api/asset`
  - `/api/assets`
  - `/api/portfolio/*`
  - `/api/scrape`
  - `/api/batch-scrape`
  - `/api/news`
  - `/api/market/*`

## Garantia do painel

Cada resposta de rota de dados enviada pelo proxy entra em `proxyOutputMonitor.outputFeed[]` com:

- rota
- app consumidor
- canal
- status HTTP
- bytes enviados
- latência
- host/região Vercel
- raízes do JSON
- métricas detectadas
- séries/pontos de gráficos
- dividendos detectados
- preview limitado do payload entregue

## Logotipo

O logotipo visual do dashboard e os assets PWA foram alterados para azul.

## Teste novo

- `test/proxy-output-real-capture-v21-12-20.test.js`

Esse teste simula:

1. uma rota interna que deve ser isolada;
2. uma rota `/api/asset` com `x-valorae-telemetry: dashboard`, que agora deve aparecer no feed;
3. uma rota externa `/api/portfolio/analyze`, também registrada como saída real;
4. presença de raízes, métricas, gráficos, dividendos e preview no item do feed.

# VALORAE Proxy Server — Deep Observability

Esta revisão amplia o app servidor do proxy com métricas didáticas e operacionais em tempo real, mantendo o projeto compatível com GitHub/Vercel gratuito.

## O que o servidor mede agora

- Requisições iniciadas e respostas finalizadas.
- Chamadas em voo.
- Latência média, p50, p95, p99 e máxima.
- Apdex simplificado para leitura da experiência percebida.
- Taxa de sucesso, erro total, erro 4xx e erro 5xx.
- Respostas lentas por limiar configurável (`VALORAE_METRICS_SLOW_MS`, padrão 2500ms).
- Bytes enviados totais e média por resposta.
- Cache hit, miss e stale.
- Status de fontes: ok, blocked, partial, drift e unknown.
- Interceptação por `sendJson` e por `res.end`.
- Distribuição por método HTTP, status, família de status, dispositivo, rota, ticker, view e interceptador.
- Detalhamento por rota: requests, responses, erro, latência média, maior latência, último status, último cache e última fonte.
- Clientes recentes com hash sanitizado, sem exibir IP real.
- Eventos recentes de resposta.
- Insights automáticos para explicar gargalos e anomalias.

## Como o tempo real funciona

O painel `/server.html` consulta `/api/server/metrics` via HTTP polling leve, por padrão a cada 2,5 segundos. Isso evita WebSocket, banco, fila, cron, Redis, Vercel KV ou qualquer recurso pago.

## Limitação intencional

As métricas são mantidas em memória por instância serverless. Elas podem reiniciar quando a instância esfriar, quando o Vercel escalar, ou quando ocorrer novo deploy. Essa decisão preserva o uso gratuito e simples.

## Páginas do painel

- Visão geral: saúde, KPIs e fluxo Cliente → Proxy → Engine → Carteira.
- Tempo real: gráficos de tráfego, status, latência, bytes e cache por minuto.
- Rotas e fontes: ranking e tabela detalhada por endpoint.
- Dispositivos: origem dos apps, clientes recentes e ativos consultados.
- Eventos: log didático das últimas respostas interceptadas.
- Insights: alertas e explicações automáticas.
- Integrações: contratos principais para APK/Web/API.
- Diagnóstico: uptime, memória, Apdex, versão e checklist de harmonia.

## Compatibilidade

O arquivo `lib/Valorae-engine.js` foi preservado como núcleo central. A observabilidade fica em `lib/observability/server-metrics.js` e é acionada pelo roteador interno, sem alterar o contrato dos apps consumidores.

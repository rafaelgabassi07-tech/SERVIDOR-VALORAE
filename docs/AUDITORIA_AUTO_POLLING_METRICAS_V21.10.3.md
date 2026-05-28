# Auditoria de auto-polling das métricas — v21.10.3

## Causa encontrada

O painel `/server.html` consulta `/api/server/metrics` em intervalo configurável para atualizar os gráficos em tempo real. Na versão anterior, essa própria consulta passava pela camada global de observabilidade e era contabilizada como tráfego do Proxy.

Resultado: os cards **Requisições** e **Respostas** continuavam subindo mesmo sem APK, app Web ou usuário terceiro consumindo dados financeiros.

## Correção aplicada

A rota `/api/server/metrics` passou a ser tratada como rota de telemetria interna do painel, não como tráfego de negócio do Proxy.

Alterações principais:

- `routes/_router.js`: ignora `/api/server/metrics` na interceptação global de tráfego do Proxy.
- `lib/http/route.js`: adiciona suporte a `metrics: false` para rotas internas.
- `lib/performance/http.js`: evita gravar respostas em métricas quando `metrics: false` é usado.
- `routes/server/metrics.js`: usa `metrics: false` tanto no início da rota quanto na resposta JSON.
- `public/server.html`: textos atualizados para explicar que os KPIs representam tráfego externo real, não o polling do painel.

## Validação local

Teste executado:

1. Chamadas repetidas para `/api/server/metrics`.
2. Conferência de `summary.requests`, `summary.responses` e `summary.inFlight`.
3. Chamada real para `/api/health`.
4. Nova conferência das métricas.

Resultado:

- Chamadas para `/api/server/metrics` não aumentam os contadores do Proxy.
- Chamadas para endpoints reais como `/api/health` continuam sendo registradas.
- O painel continua recebendo dados em tempo real por polling HTTP.

## Observação operacional

Se o usuário deixar o painel aberto, ele continuará consultando o endpoint de métricas, mas essas consultas não serão mais interpretadas como uso de APK/Web/terceiros. Isso deixa os gráficos coerentes com o tráfego real do Proxy.

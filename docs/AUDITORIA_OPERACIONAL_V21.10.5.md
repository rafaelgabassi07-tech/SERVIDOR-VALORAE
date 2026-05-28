# Auditoria operacional v21.10.5 — VALORAE Proxy Server

Esta versão continua a partir da `v21.10.4` e preserva todas as correções anteriores: PWA, configurações, tema claro/escuro, logotipo, menu por categorias e isolamento do endpoint `/api/server/metrics`.

## Correções aplicadas

- A rota `/api/server/metrics` passou a marcar explicitamente `req.__valoraeInternalTelemetry = true` antes de aplicar segurança, rate limit e resposta JSON.
- A camada `server-metrics` agora ignora também aliases internos `/api/v1/server/metrics` e `/api/v2/server/metrics`.
- O snapshot expõe `telemetrySelfPollingIsolated: true` e lista `internalTelemetryRoutes`, deixando claro que o painel não entra nos KPIs reais.
- A medição de ETag foi corrigida: respostas condicionais agora são medidas como `304`, não como `200`.
- Respostas `HEAD` e `304` agora medem `0 bytes` de saída, refletindo melhor o tráfego real.
- Fechamentos de conexão antes de `res.end` agora são finalizados como `499 client_closed`, evitando chamadas presas em `inFlight`.
- Foi adicionada limpeza de requisições ativas muito antigas para evitar contador preso em cenários de abortos raros.
- O dashboard recebeu escape defensivo de textos dinâmicos antes de inserir dados em tabelas e listas.
- O cache do Service Worker foi renomeado para a versão `v21.10.5`.

## Novo teste de integridade

Novo script:

```bash
npm run audit:metrics-integrity
```

Ele valida:

1. várias chamadas a `/api/server/metrics` não alteram requests, responses, status, rotas, cache ou fontes;
2. chamadas reais continuam sendo medidas;
3. resposta condicional `ETag` aparece como `304`;
4. conexão fechada antes da resposta aparece como `499` e não deixa `inFlight` travado.

## Limitações preservadas de propósito

- Métricas continuam em memória por instância serverless para manter compatibilidade com Vercel gratuito.
- Não foram adicionados Redis, banco, KV, WebSocket, cron, filas ou serviços pagos.
- O arquivo `lib/Valorae-engine.js` permanece preservado como núcleo central.

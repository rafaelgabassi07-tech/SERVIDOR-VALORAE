# VALORAE Proxy Server v21.10.7 — Complete Operational Polish

Esta revisão continua a evolução da v21.10.6, preservando o `lib/Valorae-engine.js` como núcleo central e mantendo compatibilidade com GitHub/Vercel gratuito.

## Correções aplicadas

- Reforcei a medição de respostas sem corpo: `HEAD`, `204` e `304` agora contabilizam `0 bytes` mesmo quando passam pela interceptação profunda de `res.end`.
- Mantive `/api/server/metrics`, `/api/v1/server/metrics` e `/api/v2/server/metrics` isolados da telemetria real.
- O dashboard agora sinaliza seu polling com `X-Valorae-Telemetry: dashboard`, facilitando auditorias futuras sem alterar a contagem real.
- Atualizei o cache do PWA para `v21-10-7`, evitando que o navegador mantenha a UI anterior em cache.

## Novas medições

- `dataQualityScore`: score didático de qualidade dos dados, considerando erro, latência lenta, cache, drift, bloqueios e respostas parciais.
- `contractScore`: score de estabilidade do contrato para apps terceiros.
- `loadScore`: score de carga operacional da instância serverless.
- `operationalState`: estado resumido (`saudável`, `atenção` ou `crítico`).
- `payloadP95BytesOut`, `payloadP99BytesOut` e `payloadMaxBytesOut`.
- `requestsPerMinute1m`, `requestsPerMinute15m`, `responsesPerMinute1m` e `responsesPerMinute15m`.
- `bytesOutPerMinute5m`.
- Lista `anomalies` para leitura rápida de 5xx, 4xx, lentidão, parcialidade, bloqueios, drift e 499.

## Dashboard

- Nova página **Qualidade dos Dados** no menu lateral.
- Novo gráfico de anomalias operacionais.
- Novos cards de qualidade, contrato, carga e payload p95.
- Explicação didática sobre como interpretar o servidor quando ele alimenta APKs, Web Apps e outros consumidores.

## Teste novo

Foi criado o comando:

```bash
npm run audit:complete-polish
```

Ele valida:

- bytes `0` em `HEAD` e `304` pela interceptação `res.end`;
- isolamento do polling interno;
- presença da nova página de qualidade;
- service worker com cache atualizado;
- service worker sem interceptar `/api`.

## Limitações mantidas de propósito

- Métricas em memória por instância serverless, sem Redis/KV/banco, para preservar o plano gratuito.
- Sem WebSocket, filas ou cron.
- O painel continua em HTML/CSS/JS puro para reduzir dependências e facilitar deploy.

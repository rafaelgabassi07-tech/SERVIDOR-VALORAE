# Auditoria v21.12.14 — Proxy Server Visual Observability

Esta etapa transforma o app visual em um painel de servidor do proxy: ele não é apenas uma tela de ativo, mas um centro de observabilidade que mostra o que passa pelas rotas `/api/*`.

## Melhorias aplicadas

- `public/server.html` e `public/index.html` reconstruídos como dashboard de servidor.
- Gráficos de fluxo vivo, status HTTP, cache/fonte, latência e Engine Core.
- Tabela de rotas consumidas por usuários, com requests, responses, erro, p95 e fonte/cache.
- Timeline de eventos recentes com rota, status, latência, payload, ticker e sinais de transformação.
- Inspetor de payloads com raízes captadas: `appMobileSnapshot`, `appPayload`, `chartSeries`, `normalized`, `results` etc.
- Probe de ativo integrada para testar `/api/asset` e alimentar métricas em tempo real.
- Fallback local por `localStorage`, evitando tela vazia quando fontes externas falham.
- `lib/observability/server-metrics.js` agora gera `payloadIntelligence` e adiciona aos eventos:
  - `payloadKind`
  - `payloadRoots`
  - `payloadSignals`
  - `payloadPreview` limitado
- Captura estrutural também para respostas diretas via `res.end` quando o corpo for JSON pequeno.

## Compatibilidade

- Mantém router único para Vercel Free.
- Não adiciona banco, Redis, KV, WebSocket, cron ou dependência paga.
- Não divide `lib/Valorae-engine.js`.
- O preview de payload é limitado e pode ser desligado com `VALORAE_METRICS_CAPTURE_PREVIEW=0`.

## Resultado

O app passa a agir como servidor/painel operacional: tudo que atravessa o proxy é refletido em métricas, painéis, gráficos e eventos, com foco em distribuição de informações aos usuários e diagnóstico anti-tela-vazia.

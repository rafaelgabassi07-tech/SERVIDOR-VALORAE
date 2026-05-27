# VALORAE Proxy Server Dashboard

Painel visual de servidor para o VALORAE Proxy em GitHub/Vercel, compatível com plano gratuito e sem dependências externas.

## Endereços

- Dashboard: `/server.html`
- Métricas JSON: `/api/server/metrics`
- Inspector técnico: `/inspector.html`

## Recursos implementados

- Material Design 3 com cards, chips, navegação lateral e cabeçalho fixo.
- Menu hambúrguer responsivo.
- Modo claro, escuro e automático com persistência em `localStorage`.
- Gráficos Canvas nativos: tráfego, latência, status HTTP, rotas e dispositivos.
- Métricas em tempo real via HTTP polling, serverless-safe.
- Registro sanitizado das solicitações que passam pelo proxy: rota, método, status, latência, bytes, cache, fonte, dispositivo e ticker quando disponível.
- Amostra de clientes por hash irreversível, sem expor IP bruto.
- Ring buffer em memória para eventos recentes e séries temporais por minuto.

## Observação importante sobre Vercel gratuito

O Vercel serverless não mantém um servidor permanente. Por isso o painel usa métricas em memória por instância ativa. Elas podem ser reiniciadas quando a função esfriar, quando houver troca de instância ou novo deploy. Isso preserva o uso gratuito e evita Redis, KV, banco, cron, WebSocket ou worker pago.

## Integração APK/Web

Configure os apps para consumir o proxy público normalmente, por exemplo:

```text
https://servidor-valorae.vercel.app/api/asset?ticker=PETR4&mode=super
https://servidor-valorae.vercel.app/api/portfolio/analyze
https://servidor-valorae.vercel.app/api/server/metrics
```

O painel estará disponível em:

```text
https://servidor-valorae.vercel.app/server.html
```

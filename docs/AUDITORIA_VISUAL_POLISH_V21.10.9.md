# Auditoria visual e operacional v21.10.9

Esta versão continua a partir da v21.10.8 e aplica uma rodada de polimento visual, identidade e inteligência operacional sem alterar a arquitetura free-only do VALORAE Proxy.

## Correções e melhorias

- Novo logotipo clean e moderno em SVG, PNG 192px e PNG 512px.
- Menu lateral com identidade visual reforçada no cabeçalho.
- Página Configurações ampliada com controle de densidade visual.
- Correção de UX: pausa manual e pausa por aba invisível agora são estados independentes.
- Dashboard passa a ocultar `unknown` em leituras de cache/fonte, mostrando `—` quando a informação não existe.
- Novas métricas didáticas no snapshot:
  - `trafficState`
  - `cacheEfficiencyScore`
  - `sourceReliabilityScore`
  - `routeCoverageScore`
  - `dashboardIntegrityScore`
- Readiness e insights agora incluem integridade do painel, cache e confiabilidade das fontes.
- Service Worker atualizado para cache `v21-10-9`, mantendo `/api` fora do cache.

## Compatibilidade preservada

- Sem Redis, banco, KV, WebSocket, cron ou filas.
- Sem dividir o `Valorae-engine.js`.
- Compatível com Vercel gratuito.
- `/api/server/metrics` continua isolado da telemetria real.

# Auditoria v21.12.21 — Proxy Monitor profissional

## Objetivo
Transformar a página do app em um verdadeiro monitor visual do proxy, com interface profissional, menu lateral por categorias, páginas bem explicadas, benchmark aprimorado e identidade visual em tons de verde e cinza.

## Melhorias aplicadas
- Cabeçalho limpo e operacional, sem teste de ticker.
- Menu hambúrguer lateral reorganizado por categorias: Operação, Distribuição, Qualidade e Documentação.
- Novas páginas internas:
  - Centro de comando
  - Feed de saída
  - Gráficos e payloads
  - Rotas e apps
  - Pipeline
  - Vercel Runtime
  - Qualidade e cache
  - Benchmark e testes
  - Integração dos apps
  - Diagnóstico bruto
- Cada página contém dois blocos explicativos para deixar claro o que a informação significa e como interpretar.
- Benchmark movido para página própria, com modo rápido, modo profundo, probes de rede e sonda real de saída.
- Visual repaginado em verde/cinza, com novo logotipo alinhado à ideia de proxy, fluxo e distribuição de dados.
- Mantida a captura de `proxyOutputMonitor.outputFeed[]`, incluindo rota, app, canal, status, bytes, raízes do JSON, métricas, gráficos, dividendos e preview do payload.

## Benchmark aprimorado
`/api/server/tests` agora inclui `benchmarkReport`, com resumo interpretável, alvos de p95, health, casos lentos, checks falhos e dicas de runtime.

## Compatibilidade
- Sem banco, KV, Redis, WebSocket ou dependência paga.
- Compatível com Vercel Free.
- `public/index.html` continua espelhando `public/server.html`.

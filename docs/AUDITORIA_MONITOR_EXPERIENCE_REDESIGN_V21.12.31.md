# Auditoria v21.12.31 — Monitor Experience Redesign

## Objetivo

Reduzir a poluição visual do Monitor Proxy, diminuir a quantidade de páginas visíveis e tornar a experiência mais profissional para uso pessoal/pessoas próximas, sem quebrar o contrato de saída do proxy.

## Mudanças principais

- Menu lateral reformulado em 7 áreas principais:
  - Centro de comando
  - Saída do proxy
  - Performance e Vercel
  - Qualidade dos dados
  - Integração e guia
  - Benchmark e diagnóstico
- Páginas antigas foram consolidadas por contexto, mantendo aliases para hashes antigos.
- Cabeçalho reduzido e menos ruidoso.
- Página de saída continua sendo a fonte fiel do proxy: rota, app, canal, status, bytes, raízes JSON, métricas, gráficos, dividendos e preview.
- Performance, Vercel, rotas e pipeline foram unidos em uma página única de observabilidade.
- Qualidade, consistência, payload, maturidade, cache e cobertura foram unidos em uma página única de decisão.
- Prompts IA, funcionalidades, tecnologia e árvore de módulos foram condensados em uma página de guia.
- Benchmark e sonda real ficaram isolados em diagnóstico, sem voltar ao cabeçalho.

## Compatibilidade

O app ainda suporta hashes antigos como `#overview`, `#feed`, `#vercel`, `#maturity`, `#manifest` e `#tests`, redirecionando internamente para as novas áreas consolidadas.

## Validação esperada

- `public/index.html` e `public/server.html` continuam espelhados.
- HTML permanece leve para Vercel Free/mobile.
- JavaScript inline passa em `node --check` quando extraído.
- Testes anteriores continuam passando por marcadores de compatibilidade não visuais.

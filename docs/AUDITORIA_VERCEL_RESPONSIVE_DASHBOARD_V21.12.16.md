# Auditoria v21.12.16 — Dashboard responsivo + Vercel Runtime visível

## Objetivo

Aprimorar a web para adaptar corretamente em telas mobile/desktop e corrigir a falta de informações da Vercel nos painéis, gráficos e medições do servidor visual.

## Correções aplicadas

- O dashboard agora possui cards dedicados para Vercel Runtime:
  - ambiente (`VERCEL_ENV`/`NODE_ENV`)
  - URL/deploy
  - região runtime
  - host observado
  - país/edge
  - commit/repositório quando as variáveis da Vercel estiverem disponíveis
- O backend agora registra por evento e rota:
  - `x-vercel-id`
  - região inferida pelo `x-vercel-id`
  - `x-forwarded-host`/`host`
  - `x-vercel-ip-country`
  - protocolo encaminhado
- `/api/server/metrics` agora entrega `vercelRuntime` e novas distribuições:
  - `distributions.vercelRegions`
  - `distributions.vercelHosts`
  - `distributions.vercelCountries`
- `deliveryHarmony.pipeline` recebeu o estágio `vercel_runtime`, deixando claro se o painel está lendo o runtime correto.
- `routeDetails` agora mostra `topVercelRegion` e `topHost` por rota.
- Eventos recentes mostram região e host, facilitando confirmar se os dados vieram da Vercel publicada.

## Responsividade web

- Adicionados breakpoints para:
  - mobile estreito até 430px
  - mobile/tablet até 720px
  - tablets/desktops médios até 1180px
- Cards, toolbar, gráficos, tabelas e tabs agora se reorganizam sem quebrar layout.
- Tabelas largas usam rolagem horizontal em telas pequenas.
- Gráficos reduzem altura em mobile para evitar excesso de rolagem.

## Correção de origem da API

Adicionado botão **API origem** no painel. Ele permite configurar a origem Vercel que o dashboard deve consultar para `/api/server/metrics`, usando:

- query string `?apiBase=https://seu-deploy.vercel.app`
- ou `localStorage` em `valorae:apiBase`

Isso evita o problema em que a tela está aberta em uma origem, mas tenta ler métricas de outra instância/deploy.

## Arquivos alterados

- `lib/observability/server-metrics.js`
- `public/server.html`
- `public/index.html`
- `test/vercel-responsive-dashboard-v21-12-16.test.js`
- `package.json`
- `metadata.json`
- `docs/CHANGELOG.md`

## Validação

- Checagem sintática de arquivos JS.
- Teste novo de telemetria Vercel + responsividade.
- Testes anteriores de servidor visual e harmonia Vercel/apps continuam passando.

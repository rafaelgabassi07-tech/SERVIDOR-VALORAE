# Auditoria v21.12.18 — Proxy Output Server Page

## Objetivo

Refazer a página web para agir como uma página-servidor do proxy: um espelho das respostas que saem do Valorae Engine para os apps e usuários do ecossistema.

## Correção de entendimento

A página anterior ainda parecia um dashboard financeiro/operacional. Esta versão passa a priorizar o que o usuário pediu: tudo que entra no proxy, é transformado, e principalmente tudo que sai para consumidores externos.

## Backend adicionado

Novo bloco em `/api/server/metrics`:

- `proxyOutputMonitor`
- `proxyOutputMonitor.totals`
- `proxyOutputMonitor.outputFeed[]`
- `proxyOutputMonitor.routeOutputs[]`
- `proxyOutputMonitor.rootCoverage`
- `proxyOutputMonitor.appContractCoverage`
- `proxyOutputMonitor.selectedOutput`
- `proxyOutputMonitor.scope`

Cada item de `outputFeed` representa uma resposta entregue pelo proxy e contém:

- rota
- método
- status HTTP
- latência
- bytes enviados
- app consumidor
- canal
- device
- host/região Vercel
- ticker/view quando disponível
- cache/fonte
- tipo do payload
- raízes do payload
- sinais de métricas/gráficos/dividendos
- decisão de sync/render/cache
- preview limitado do JSON entregue

## Página refeita

Arquivos refeitos:

- `public/server.html`
- `public/index.html`

A página agora mostra:

- Saídas do proxy
- Payloads observados
- Transformados para apps
- Métricas/gráficos/dividendos enviados
- Integridade de captura entrada → saída
- Vercel host/região/ambiente
- Feed de tudo que saiu do proxy
- Payload selecionado com preview
- Rotas distribuindo informações
- Apps/canais consumidores
- Pipeline do proxy
- Matriz de distribuição
- JSON bruto do monitor

## Limite honesto do Vercel Free

Sem banco, Redis, KV ou WebSocket, o painel mostra a memória da instância serverless atual. Para observar 100% do ecossistema em produção, todos os apps devem consumir o mesmo deploy/origem do proxy ou enviar os cabeçalhos:

- `x-valorae-app`
- `x-valorae-channel`
- `x-valorae-app-version`
- `x-valorae-build`

## Validações executadas

- `npm run check`
- `npm test`
- `npm run build`
- `npm run audit:vercel-api`
- `npm run audit:dashboard-live`
- `npm run audit:live-endpoints`
- `npm run audit:single-app`
- `npm run smoke`
- `npm run typecheck`
- `npm run audit:free`

## Resultado

A aplicação agora está orientada a servidor/observabilidade de saída do proxy, não a tela de ativo. A consulta de teste existe apenas para gerar tráfego real e demonstrar que uma resposta que sai do proxy aparece no feed.

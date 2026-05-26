# VALORAE Proxy Observability

O painel principal em `/` é uma interface web inspirada em Material Design 3 para monitorar o canal Proxy consumido por apps terceiros.

## Organização por páginas

O dashboard usa menu hambúrguer e navegação lateral com páginas independentes:

- Visão Geral: KPIs principais, status, cache e limitações de medição.
- Tráfego: status HTTP, métodos, protocolos, payload e CORS.
- Desempenho: latência média, P95, P99, erros, throughput e requests ativos.
- Upstreams: famílias de rotas e endpoints mais chamados.
- Clientes: apps consumidores, client id/token anonimizado, user agents e autenticação.
- Segurança: bloqueios, requisições suspeitas, CORS, IPs anonimizados e autenticação.
- Rate Limit: bloqueios 429, timeouts, circuit breaker e eventos de erro.
- Infraestrutura: processo Node, memória, CPU, event loop lag, sockets locais e status.
- Logs: eventos recentes capturados pelo Proxy.

## Tema claro e escuro

O botão de tema no topo alterna entre modo claro e escuro. A preferência é salva em `localStorage` com a chave `valorae-theme`.

## Fonte dos dados

Todas as páginas leem dados reais de `/api/observability`. O endpoint consolida métricas capturadas em memória por `lib/observability/metrics.js` enquanto o tráfego passa por `/api/*`.

Para evitar distorção, o polling interno do painel em `/api/observability` não é contabilizado como tráfego do Proxy.

## Métricas realmente medidas

Medidas diretamente pelo app:

- Total de requests, requests concluídos e erros.
- RPS/RPM dentro da janela selecionada.
- Latência média, P95 e P99.
- Status HTTP e classes 2xx/3xx/4xx/5xx.
- Métodos HTTP.
- Protocolos via `httpVersion` e `x-forwarded-proto`.
- Bytes de entrada e saída observados.
- Payload por buckets.
- Cache hit/miss/bypass por headers de resposta.
- CORS/origins por header `Origin`.
- Clientes por headers `x-valorae-client-id`, `x-client-id`, `x-app-id`, `x-api-client`, query string ou origin.
- User agents.
- IPs anonimizados com hash curto.
- Bloqueios por status 401, 403 e 429.
- Timeouts por status 408 e 504.
- Memória, CPU média, uptime e event loop lag do processo Node.
- Open sockets quando executado pelo `server.js` local.

## Métricas não inventadas

Algumas informações não são fabricadas quando o app não consegue medir com honestidade:

- GeoIP/país/região: não medido sem banco GeoIP ou serviço externo.
- Handshakes TLS reais: não medidos quando TLS termina na plataforma, como Vercel.
- Fila interna persistente: não existe neste Proxy free-only, então aparece como não medida.

Esses itens são mostrados explicitamente como “não medido” no painel.

## Responsividade mobile/desktop

A interface foi ajustada para funcionar em desktop, tablet e mobile:

- Desktop amplo: grids ampliados para mais cards por linha e largura máxima centralizada.
- Tablet: drawer vira painel lateral sobreposto com overlay e fechamento por toque fora ou tecla Esc.
- Mobile: cards em coluna única, gráficos redimensionados, botões com área de toque maior e tabelas convertidas em cartões com rótulos por campo.
- Telas muito estreitas: o cabeçalho reduz metadados secundários para preservar espaço útil.
- `prefers-reduced-motion` é respeitado para reduzir animações quando configurado pelo usuário.

## Probes reais sem poluir métricas

A página de Infraestrutura consulta `/api/health` e `/api/ready` com o header `X-Valorae-Dashboard-Probe: 1`. Essas chamadas são reais e verificam as rotas do app, mas são excluídas da contagem de tráfego do Proxy para não distorcer RPS, clientes, endpoints e status HTTP.

O contador `measurement.internalProbeReads` em `/api/observability` registra quantos probes internos do dashboard foram ignorados pela coleta de tráfego.

## Camada de entrega: dados e arquivos

O painel agora inclui a página **Entrega**, dedicada a verificar se o aplicativo trabalha em harmonia com o Proxy como uma extensão de observabilidade:

- Respostas `/api/*` são classificadas por família de rota, bytes enviados, tipo de conteúdo e erro.
- Arquivos públicos servidos pelo `server.js` local são medidos por caminho, extensão, Content-Type, status, bytes enviados e última atividade.
- Content-Type de APIs e assets é derivado dos headers reais de resposta.
- O app não armazena corpo de resposta, conteúdo de arquivos nem IP bruto; guarda apenas metadados técnicos, contadores, bytes e hashes curtos.
- Em Vercel, assets estáticos de `public/` podem ser entregues diretamente pela plataforma fora do runtime Node. Por isso, essa métrica é marcada como medida apenas quando o arquivo passa pelo `server.js` local.

## Auditoria de harmonia

Use o comando abaixo para validar especificamente a integração entre Proxy, dashboard e observability:

```bash
npm run audit:observability
```

Essa auditoria verifica:

- Requisições reais do Proxy aparecem em `/api/observability`.
- Polling de `/api/observability` não polui o tráfego.
- Probes internos `health/ready` são contados separadamente.
- Clientes, CORS, Content-Type, bytes de API e arquivos públicos são medidos.
- IPs permanecem anonimizados.
- O painel declara explicitamente que não armazena corpo de resposta.

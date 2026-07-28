# VALORAE Proxy

Proxy Vercel estritamente sob demanda para o APK VALORAE. O runtime possui uma única função física (`api/router.js`), não contém cron e não inicia consultas, timers ou coleta de dados ao ser importado. Em produção, as rotas da API aceitam somente requisições com a identidade canônica do APK.

## Banco mínimo

Execute no Supabase, nesta ordem:

1. `supabase/01_transactions.sql`
2. `supabase/02_dividends.sql`
3. `supabase/03_legacy_block_and_verification.sql`

Não existem SQLs de snapshot, monitor, cache, dispositivo ou estado operacional. Circuit breaker, cache negativo, coalescência e continuidade usam somente memória efêmera da instância.

## Runtime

- `POST /api/v1/mobile/alerts`: consolida cotações, dividendos e notícias da Central de Notificações e dos workers em uma única invocação, executando somente os blocos explicitamente solicitados pelo APK.
- `GET /api/v1/quotes`: cotações de primeiro plano solicitadas pelo APK.
- `GET /api/v1/news`: notícias de primeiro plano solicitadas pelo APK.
- `POST /api/v1/dividends/batch`: agenda de dividendos solicitada pelo APK.
- `/api/sync`: transações, dividendos e verificação/bloqueio legado.

As rotas não executam pré-busca. Cada produtor de informação só é carregado quando a requisição recebida solicita o respectivo bloco.

## Monitor

`public/index.html` é a única página estática do monitor. O monitor não chama a API, não consulta métricas do Vercel, não possui polling, JavaScript de rede, WebSocket, EventSource. Ele apenas informa o estado arquitetural do Proxy.

A telemetria detalhada do runtime foi removida do fluxo operacional. Para confirmar que a importação da função não inicia trabalho autônomo, execute `npm run audit:on-demand`.

## Proteção do cliente

Na Vercel ou com `NODE_ENV=production`, o modo APK-only é habilitado por padrão. Não configure `VALORAE_APK_ONLY=false` em produção. Os valores esperados podem ser ajustados por:

- `VALORAE_ANDROID_APP_ID`
- `VALORAE_MOBILE_PROTOCOL`

Para o uso privado solicitado, não existe segredo compartilhado entre APK e Proxy e nenhuma variável de autenticação precisa ser configurada manualmente. A rota `/api/sync` continua validando a sessão do usuário pelo token Bearer do Supabase.

## Validação

```bash
npm run build
npm run check:syntax
npm run audit:on-demand
npm run audit:dead-code
npm run audit:sql
npm run test:cross-stack
```

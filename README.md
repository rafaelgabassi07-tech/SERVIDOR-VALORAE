# VALORAE Proxy

Proxy Vercel sob demanda para o APK VALORAE. O runtime possui uma única função física (`api/router.js`), não contém cron e não executa consultas sem uma requisição HTTP do cliente.

## Banco mínimo

Execute no Supabase, nesta ordem:

1. `supabase/01_transactions.sql`
2. `supabase/02_dividends.sql`
3. `supabase/03_legacy_block_and_verification.sql`

Não existem SQLs de snapshot, monitor, cache, dispositivo ou estado operacional. Circuit breaker, cache negativo, coalescência e continuidade usam somente memória efêmera da instância.

## Runtime

- `POST /api/v1/mobile/alerts`: consolida cotações, dividendos e notícias da Central de Notificações e dos workers em uma única invocação, executando somente os blocos explicitamente solicitados pelo APK.
- `GET /api/v1/quotes`: cotações de primeiro plano solicitadas pelo APK.
- `GET /api/v1/news`: notícias foreground.
- `POST /api/v1/dividends/batch`: agenda foreground.
- `/api/sync`: transações, dividendos e verificação/bloqueio legado.

## Observabilidade

A coleta detalhada por resposta fica desativada por padrão para não aumentar o Fluid Active CPU. Ela só é carregada quando `VALORAE_METRICS_ENABLED=1`. A página de monitor não possui polling e consulta as métricas exclusivamente por ação manual.

## Validação

```bash
npm run build
npm run check:syntax
npm run audit:dead-code
npm run test:cross-stack
```

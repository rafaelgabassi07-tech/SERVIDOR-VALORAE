# Operação — Valorae Proxy

## Health e readiness

- `/api/health`: status de vida do runtime.
- `/api/v1/ready`: validação de prontidão de lançamento sem chamadas externas.
- `/api/v1/manifest`: capacidades, rotas, aliases, política free-only e recursos de carteira.
- `/api/v1/cache/stats`: métricas de cache da instância quente.

## Cache

O cache é apenas em memória. Ele é rápido e gratuito, mas pode zerar quando a função serverless esfriar ou escalar. Isso é esperado.

## Falhas de fonte

Fontes públicas podem bloquear scraping, mudar HTML ou limitar requests. O VALORAE usa:

- `parserResilience`
- `sourceDrift`
- `sourceReport`
- `quality`
- `fieldConfidence`

Esses campos ajudam o app Web/APK a decidir se deve exibir alerta, fallback ou reduzir confiança.

## Segurança operacional

- CORS é aplicado no runtime.
- Rate limit é em memória por rota/IP.
- `scrapeUrl` de cliente é ignorada por padrão.
- `/api/sync` é opcional e ativo quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existem no Vercel. Use `GET /api/sync?action=diagnostics` para confirmar funcionamento real.
- Admin só liga com `VALORAE_ADMIN_TOKEN`.


## Supabase operacional

Para confirmar se está funcionando de fato:

1. Abra `/api/sync?action=health`.
2. Confirme `supabase.configured: true`.
3. Abra `/api/sync?action=diagnostics`.
4. Confirme `ok: true` e todas as tabelas com `accessible: true`.

Se `health` estiver `true`, mas `diagnostics` falhar, o problema normalmente é um destes pontos:

- URL do Supabase errada ou colada com caminho incorreto.
- `SUPABASE_SERVICE_ROLE_KEY` ausente, inválida ou copiada incompleta.
- tabelas ainda não criadas.
- nomes das tabelas diferentes das variáveis `VALORAE_SUPABASE_*_TABLE`.
- projeto Supabase pausado/inacessível.

Nunca coloque a service role key no APK. Ela deve ficar somente nas variáveis de ambiente do Vercel.

## Plano de rollback

1. Volte para a release ZIP anterior no GitHub.
2. Redeploy na Vercel.
3. Verifique `/api/v1/ready`.
4. Confirme `/api/v1/asset?ticker=PETR4&view=quote&profile=quote`.

## v21.12.0 — Scraper/API otimizado

O VALORAE agora possui cache final de resultado para `/api/scrape` e `/api/batch-scrape`, chave HTML segura contra contaminação por truncamento, batch coalescido por `fetchKey`, fast-path conservador para seletores simples, métricas detalhadas de scraping e controles mobile (`compact=1`, `previewChars` e `fields=`). Tudo permanece free-only, sem dependências obrigatórias e sem desmembrar `lib/Valorae-engine.js`.

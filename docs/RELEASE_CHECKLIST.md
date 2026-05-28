# Release Checklist — Valorae Proxy v21.11.4

Use este checklist antes de publicar no GitHub/Vercel.

## Antes do push

```bash
npm run verify
```

O comando deve passar em:

- `check`
- `test`
- `typecheck`
- `audit:functions`
- `audit:free`
- `audit:version`
- `audit:routes`
- `audit:release`
- `smoke`
- `build`

## Estrutura esperada

- Apenas `api/index.js` e `api/[...path].js` como Functions físicas.
- Rotas internas em `routes/`.
- Núcleo preservado em `lib/Valorae-engine.js`.
- Zero dependências obrigatórias no `package.json`.
- Sem Redis, KV, banco, storage externo, cron pago, WebSocket ou worker permanente.

## Após deploy

Abra:

```text
/api/v1/ready
/api/v1/manifest
/api/health
/api/openapi
/inspector.html
```

A rota `/api/v1/ready` deve retornar `status: READY`.

## Variáveis opcionais

- `VALORAE_PUBLIC_BASE_URL`: URL pública do deploy.
- `VALORAE_CORS_ALLOW_ORIGINS`: allowlist CORS separada por vírgula.
- `VALORAE_ADMIN_TOKEN`: habilita endpoints admin.

Não configure Redis, KV, Supabase, Firebase, MongoDB, Postgres, Prisma, cron pago ou workers permanentes.

## v21.11.4 — Scraper/API otimizado

O VALORAE agora possui cache final de resultado para `/api/scrape` e `/api/batch-scrape`, chave HTML segura contra contaminação por truncamento, batch coalescido por `fetchKey`, fast-path conservador para seletores simples, métricas detalhadas de scraping e controles mobile (`compact=1`, `previewChars` e `fields=`). Tudo permanece free-only, sem dependências obrigatórias e sem desmembrar `lib/Valorae-engine.js`.

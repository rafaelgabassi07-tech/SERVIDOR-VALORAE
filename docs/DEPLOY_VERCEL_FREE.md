# DEPLOY_VERCEL_FREE

1. Suba o repositório no GitHub.
2. Importe na Vercel pelo plano gratuito.
3. Use Node.js 20+.
4. Não configure Redis, Vercel KV, banco, storage externo, cron pago, WebSocket ou worker permanente.
5. Opcionalmente configure `VALORAE_PUBLIC_BASE_URL=https://seu-deploy.vercel.app`.

Antes do deploy, rode:

```bash
npm run verify
```

Ou manualmente:

```bash
npm run check
npm test
npm run typecheck
npm run audit:functions
npm run audit:free
npm run audit:version
npm run audit:routes
npm run audit:release
npm run smoke
npm run build
```

O guardrail aceita apenas `api/index.js` e `api/[...path].js` como Functions físicas.


Depois do deploy, valide:

```text
/api/v1/ready
/api/v1/manifest
/api/openapi
/inspector.html
```

A build não usa `tsc`, Redis, KV, banco, storage externo ou cron pago.

## v21.11.4 — Scraper/API otimizado

O VALORAE agora possui cache final de resultado para `/api/scrape` e `/api/batch-scrape`, chave HTML segura contra contaminação por truncamento, batch coalescido por `fetchKey`, fast-path conservador para seletores simples, métricas detalhadas de scraping e controles mobile (`compact=1`, `previewChars` e `fields=`). Tudo permanece free-only, sem dependências obrigatórias e sem desmembrar `lib/Valorae-engine.js`.

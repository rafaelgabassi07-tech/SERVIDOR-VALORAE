# Troubleshooting — Valorae Proxy

## Deploy falha na Vercel

Rode localmente:

```bash
npm run verify
npm run build
```

O projeto não exige `npm install` de dependências porque `dependencies` é vazio.

## CORS bloqueado

Para API pública/demo, deixe CORS padrão. Para produção restrita:

```bash
VALORAE_CORS_STRICT=1
VALORAE_PUBLIC_BASE_URL=https://seu-proxy.vercel.app
VALORAE_CORS_ALLOW_ORIGINS=https://seu-app.vercel.app
```

## Fonte externa sem dados

Use:

- `/api/v1/source/status`
- `/api/v1/cache/stats`
- `profile=instant` para fallback rápido
- `debug=1` apenas em desenvolvimento

## Payload grande

Use:

```text
?lean=1&view=card&profile=quote&maxItems=20&fields=ticker,normalized,quality
```

## Carteira sem score bom

Informe `quantity`, `averagePrice`, `currentPrice/currentValue`, `targetPercent`, `objective`, `account`, `issuer` e `tags` por posição.

## v21.11.8 — Scraper/API otimizado

O VALORAE agora possui cache final de resultado para `/api/scrape` e `/api/batch-scrape`, chave HTML segura contra contaminação por truncamento, batch coalescido por `fetchKey`, fast-path conservador para seletores simples, métricas detalhadas de scraping e controles mobile (`compact=1`, `previewChars` e `fields=`). Tudo permanece free-only, sem dependências obrigatórias e sem desmembrar `lib/Valorae-engine.js`.

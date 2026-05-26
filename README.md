<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7d32f97f-2a54-4b67-afb6-ae047eea246f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Atualização v1.8.5

- Motor de scraping atualizado com parser de seções para Investidor10.
- Notícias via Google News RSS com filtro por ticker/alias e deduplicação.
- Compatibilidade Vercel corrigida: APIs em `api/*.ts`, frontend Vite em `dist` e motor fora de `/api`.
- Endpoints principais: `/api/asset`, `/api/assets`, `/api/news`, `/api/scrape`, `/api/sync`.

Teste após o deploy:

```bash
/api
/api/news?ticker=PETR4
/api/asset?ticker=PETR4&includeNews=1
/api/assets?tickers=PETR4,GARE11,VISC11&includeNews=1
```

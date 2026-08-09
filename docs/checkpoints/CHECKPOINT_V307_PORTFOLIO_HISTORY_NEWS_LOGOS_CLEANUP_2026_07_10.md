# Proxy v307 — Histórico da carteira, notícias, logos e limpeza

Release pública `21.12.339`, pareada ao APK v471 / Checkpoint 61.

## Mudanças

- Alinhamento integral da série intradiária ao valor atual antes do ponto final.
- Limite adaptativo para descartar extremos isolados nas bordas.
- Yahoo como fonte prioritária de logos e fallback binário oficial do Status Invest.
- Feed amplo real quando a consulta específica da carteira não encontra matérias recentes.
- Remoção do card sintético de busca; estado `EMPTY` preserva `searchUrl` apenas como metadado.
- Teste de higiene contra arquivos temporários e regressões de histórico, notícias e logos.

## Validação

- `npm run verify`
- `node test/portfolio-history-intraday-official-close-v307.test.js`
- `node test/news-real-feed-no-synthetic-v307.test.js`
- `node test/official-logo-fallback-v307.test.js`
- `node test/release-hygiene-portfolio-news-logos-v307.test.js`

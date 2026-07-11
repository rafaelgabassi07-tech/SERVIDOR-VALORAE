# VALORAE Proxy v154 — Busca online textual de notícias

Proxy v154 aceita busca textual livre em /api/v1/news por query/search, preservando busca por tickers para carteira e ranking.

## Alterações
- `lib/sources/news.js` diferencia busca textual livre de ticker.
- `query`, `search`, `term` e `keyword` são aceitos como termos livres.
- `q` continua compatível: se parecer ticker, é tratado como ticker; caso contrário, vira busca textual.
- O contrato antigo de `symbols`/`ticker` foi preservado.

## Validação
- `node --check` executado nos arquivos JS alterados.
- Estrutura de ZIP permanece pronta para AI Studio/Vercel sem pasta wrapper.

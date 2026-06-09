# VALORAE Proxy v21.12.72 — Auditoria final Charts + Notícias

## Escopo
Correção de compatibilidade com APK v2.0.36 para notícias globais e manutenção do contrato dos gráficos financeiros.

## Arquivos alterados

- `routes/news.js`
- `lib/Valorae-engine.js`
- `lib/market/investidor10-chart-extractor.js`
- `lib/performance/profile.js`
- `lib/observability/server-metrics.js`
- `routes/integration/manifest.js`
- `routes/release/readiness.js`
- `metadata.json`
- `package.json`
- `public/index.html`
- `public/server.html`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- testes de versão/monitor
- `test/news-global-route-v21-12-72.test.js`

## Correções principais

### Notícias globais
A rota `/api/v1/news` agora aceita chamada sem ticker. Antes, ticker vazio era validado e podia virar erro 400, fazendo a página Notícias do APK ficar vazia.

### Engine de notícias
`fetchGoogleNews()` agora diferencia:

- notícia por ativo: usa ticker, aliases e `.SA`;
- notícia global: usa termos de mercado brasileiro como B3, Ibovespa, ações, FIIs, dividendos e proventos.

A chave de cache global usa `GERAL`.

### Service Worker / PWA
Cache atualizado para `valorae-proxy-server-v21-12-72`, invalidando shell antigo.

## Validações executadas

```bash
node --check lib/market/investidor10-chart-extractor.js
node --check lib/Valorae-engine.js
node --check routes/news.js
node scripts/audit-version-consistency.js
npm run check
npm test -- --runInBand
```

Resultado:

```text
Checked 291 JS files
Version consistency OK: core 21.12.0; release 21.12.72-valorae-final-ui-charts-news-backup-fix.
VALORAE test runner: 92 arquivos executados; falhas=0; lentos=nenhum
```

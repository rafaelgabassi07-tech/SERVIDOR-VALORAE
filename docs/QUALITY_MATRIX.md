# Quality Matrix — Valorae v21.12.0

A v21.12.0 implementa somente melhorias recomendadas e viáveis:

- maturidade de lançamento: `.nvmrc`, licença, security, contributing, env docs e troubleshooting;
- fonte/confiabilidade: fixtures adicionais, `/api/v1/source/status` e matriz de providers;
- performance/cache: headers de schema/source/cache, TTL matrix e rota de cache mantida;
- carteira: `healthScore`, `incomeStabilityScore`, `dividendCoverage`, ranking e narrativa;
- API/contrato: `/api/v1/schema`, `/api/v1/env`, OpenAPI com `operationId`;
- segurança: CORS strict opcional, limites de URL/query e proteção contra rate-limit desligado acidentalmente em produção;
- testes/auditorias: auditoria v21.12.0 para contrato, segurança e melhorias recomendadas.

Ficaram fora: Redis/KV, bancos, storage, cron pago, WebSocket, worker permanente, frameworks pesados e renda fixa avançada.

## v21.12.0 — Scraper/API otimizado

O VALORAE agora possui cache final de resultado para `/api/scrape` e `/api/batch-scrape`, chave HTML segura contra contaminação por truncamento, batch coalescido por `fetchKey`, fast-path conservador para seletores simples, métricas detalhadas de scraping e controles mobile (`compact=1`, `previewChars` e `fields=`). Tudo permanece free-only, sem dependências obrigatórias e sem desmembrar `lib/Valorae-engine.js`.

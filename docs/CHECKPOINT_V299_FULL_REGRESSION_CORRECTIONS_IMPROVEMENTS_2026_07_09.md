# Proxy v299 — Testes amplos, correções e melhorias (2026-07-09)

## Escopo
Auditoria ampla pós-v298 com foco em rotas críticas do Proxy usadas pelo APK: modais full-only, `/portfolio/history`, cotações, agenda/proventos, análise, contratos mobile, Supabase e empacotamento Vercel/AI Studio.

## Correções e melhorias aplicadas
- `lib/portfolio/history.js` ganhou `stabilizeIntradayEdgePoints` para remover outlier isolado em extremidades intradiárias quando os vizinhos estão estáveis.
- A série continua exigindo cobertura completa por timestamp intradiário antes de emitir ponto de carteira.
- Adicionado teste de regressão `portfolio-history-intraday-edge-stability-v299.test.js`.
- Metadados, manifesto, service worker, package e auditoria de versão atualizados para `21.12.328-full-regression-corrections-improvements-v299`.

## Validação
- `npm run build`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`
- `node test/portfolio-history-intraday-edge-stability-v299.test.js`
- `npm run verify`
- `unzip -t` no ZIP final.

## Limitação
Não houve deploy externo/Vercel nesta etapa; os testes foram locais e automatizados sobre o pacote entregue.

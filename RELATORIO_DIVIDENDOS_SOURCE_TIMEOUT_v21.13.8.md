# VALORAE Proxy v21.13.8 — Correção Agenda/Evolução de Proventos

## Diagnóstico corrigido

A Agenda de Dividendos e a Evolução de Proventos podiam ficar vazias quando StatusInvest/Investidor10 não respondiam dentro do deadline mobile. O Proxy retornava arrays vazios com `sourceStatus: EMPTY`, o que fazia o APK interpretar falha de fonte como ausência real de dados.

## Correções aplicadas

- `buildDividendsContract` agora usa deadline padrão maior: 11s no mobile e 18s em deep/background.
- `sourceStatus` não fica mais `EMPTY` quando a fonte falha por timeout. Nesses casos retorna `SOURCE_TIMEOUT`, `partial: true` e `retryAfterMs: 30000`.
- Cache fresco não usa stale automaticamente no início; stale só é promovido quando há snapshot válido e a fonte falha.
- Resultados vazios parciais não são cacheados como verdade de negócio.
- Agenda Investidor10 deixa de ser limitada a 3 meses no modo normal; usa 18–24+ meses conforme payload, com limite seguro de páginas/deadline.
- `getAgendaDividends` agora respeita `deadlineAt`, `maxPages` e timeout por página para não continuar pendurado após deadline mobile.
- Fetch externo aceita `AbortSignal` e normaliza abort/timeout.
- StatusInvest recebeu fallback HTML básico para `assetEarningsModels` quando o endpoint JSON falhar.
- Rotas `/asset/dividends`, `/asset/next-dividend`, `/portfolio/events`, `/portfolio/next-dividends` agora expõem `sourceStatus`, `partial` e `retryAfterMs` coerentes.
- `mobile/portfolio-sync` passa deadlines dedicados para dividendos e não corta mais o bloco em ~2,6s.

## Validações

- `npm test`: 14 arquivos de teste, 0 falhas.
- `npm run audit:version`: OK para 21.13.8.
- `npm run verify`: OK.
- `npm run check`: 40 arquivos JS verificados.

## Arquivos principais alterados

- `lib/portfolio/dividends-contract.js`
- `lib/contracts/mobile.js`
- `lib/sources/agenda-dividends.js`
- `lib/sources/status-dividends.js`
- `lib/sources/fetch.js`
- `routes/_router.js`
- `test/zz-dividends-source-timeout.test.js`

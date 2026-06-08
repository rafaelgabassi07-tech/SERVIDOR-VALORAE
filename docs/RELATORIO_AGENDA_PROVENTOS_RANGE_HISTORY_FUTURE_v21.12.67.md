# VALORAE Proxy v21.12.67 — Agenda e Proventos com Varredura Mensal

## Objetivo

Corrigir a limitação em que a Agenda de Dividendos e a Evolução de Proventos ficavam restritas ao mês corrente do Investidor10.

## Causa raiz

As URLs base do Investidor10 (`/acoes/dividendos/` e `/fiis/dividendos/`) carregam o mês vigente. Os meses anteriores e futuros usam URLs mensais, por exemplo:

- `/acoes/dividendos/2026/maio/`
- `/acoes/dividendos/2026/julho/`
- `/fiis/dividendos/2026/julho/`

Consultar só a URL base fazia o Proxy entregar somente eventos do mês atual.

## Arquivos alterados

- `lib/market/investidor10-dividend-agenda.js`
- `routes/portfolio/dividends.js`
- `routes/portfolio/next-dividends.js`
- `routes/asset/dividends.js`
- `routes/asset/next-dividend.js`
- `lib/observability/server-metrics.js`
- `routes/integration/manifest.js`
- `routes/release/readiness.js`
- `public/index.html`
- `public/server.html`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `package.json`
- `metadata.json`
- testes de versionamento/compatibilidade em `test/`

## Correções implementadas

1. O parser de agenda agora aceita intervalo:
   - `futureMonths`
   - `monthsForward`
   - `historyMonths`
   - `monthsBack`
   - `startDate`

2. O Proxy gera URLs mensais automaticamente em português:
   - `janeiro`, `fevereiro`, `marco`, `abril`, `maio`, `junho`, `julho`, `agosto`, `setembro`, `outubro`, `novembro`, `dezembro`.

3. A agenda passa a buscar:
   - ações;
   - FIIs;
   - meses passados para evolução de proventos;
   - meses futuros para agenda.

4. As rotas de carteira preservam o contrato antigo:
   - `events`
   - `dividends`
   - `dividendos`
   - `proventos`
   - `agendaEvents`
   - `upcomingEvents`
   - `historyEvents`

5. Eventos provisionados/anunciados sem data de pagamento explícita são preservados quando têm `Data Com`, ticker, tipo e valor.

6. Em `/portfolio/next-dividends`, eventos sem `paymentDate`, mas com `dateCom` futura, agora entram como próximos/anunciados, não como histórico.

7. Quando todas as posições enviadas pelo APK são de uma classe só, o Proxy consulta só a fonte necessária (`ACAO` ou `FII`), reduzindo carga e risco de timeout.

## Status dos eventos

- Com `paymentDate`: `CONFIRMED` / `Confirmado`.
- Sem `paymentDate`, mas com dados de provento: `PROVISIONED` / `Anunciado/Provisionado`.
- Com `Data Com` e valor: `ANNOUNCED` / `Anunciado`.

## Testes executados

```bash
node --check lib/market/investidor10-dividend-agenda.js
node --check routes/portfolio/dividends.js
node --check routes/portfolio/next-dividends.js
node --check routes/asset/dividends.js
node --check routes/asset/next-dividend.js
node --check lib/observability/server-metrics.js
node scripts/audit-version-consistency.js
npm test -- --runInBand
```

Resultado:

```text
Version consistency OK: core 21.12.0; release 21.12.67-valorae-i10-dividend-agenda-range-history-future.
VALORAE test runner: 91 arquivos executados; falhas=0; lentos=nenhum
```

## Teste específico novo

Foi adicionado teste com `global.fetch` simulado para garantir que o Proxy consulta URLs de meses fora do mês corrente:

- `/acoes/dividendos/2026/julho/`
- `/fiis/dividendos/2026/maio/`

E retorna eventos como:

- `PETR4` com pagamento futuro fora do mês atual;
- `HGLG11` com pagamento histórico fora do mês atual.

## Observações operacionais

O Proxy agora faz mais consultas quando o APK pede histórico amplo. Para evitar excesso:

- o intervalo é limitado por `VALORAE_I10_DIVIDEND_AGENDA_MAX_RANGE_MONTHS`, padrão `72`;
- a concorrência é limitada por `VALORAE_I10_DIVIDEND_AGENDA_CONCURRENCY`, padrão `4`;
- o cache da agenda mantém resultados por `VALORAE_I10_DIVIDEND_AGENDA_TTL_MS`, padrão `5 minutos`.

## Versão

```text
21.12.67-valorae-i10-dividend-agenda-range-history-future
```

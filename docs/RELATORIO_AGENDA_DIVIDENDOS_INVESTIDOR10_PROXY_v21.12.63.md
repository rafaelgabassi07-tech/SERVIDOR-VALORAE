# RELATÓRIO — Agenda de Dividendos Investidor10 no VALORAE Proxy v21.12.65

## Objetivo
Corrigir a ausência de eventos no modal Agenda de Dividendos do APK VALORAE, garantindo que o Proxy entregue eventos futuros e históricos reais de ações e FIIs a partir do Investidor10.

## Causa raiz encontrada
1. A rota `/api/v1/asset/dividends` expunha principalmente `historico`, mas o APK não consumia esse alias em todos os fluxos.
2. As páginas gerais de agenda do Investidor10 usam datas curtas `DD/MM/YY`, enquanto parte do Proxy esperava apenas `DD/MM/YYYY`.
3. O Proxy priorizava histórico da página do ativo e não capturava a agenda geral de próximos pagamentos em `/acoes/dividendos/` e `/fiis/dividendos/`.
4. Endpoints de carteira não mesclavam corretamente eventos futuros da agenda geral com histórico por ativo.

## Fontes canônicas configuradas
- Ações: `https://investidor10.com.br/acoes/dividendos/`
- FIIs: `https://investidor10.com.br/fiis/dividendos/`
- Histórico por ativo: páginas individuais como `/acoes/PETR4/` e `/fiis/HGLG11/`.

## Arquivos alterados
- `lib/market/investidor10-dividend-agenda.js`
- `lib/Valorae-engine.js`
- `routes/asset/dividends.js`
- `routes/asset/next-dividend.js`
- `routes/portfolio/dividends.js`
- `routes/portfolio/next-dividends.js`
- `package.json`
- `metadata.json`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `public/index.html`
- `public/server.html`
- `routes/integration/manifest.js`
- `routes/release/readiness.js`
- `lib/observability/server-metrics.js`
- `test/investidor10-dividend-agenda-v21-12-63.test.js`

## Novo módulo
Criado `lib/market/investidor10-dividend-agenda.js` com:
- `fetchInvestidor10DividendAgenda`
- `parseInvestidor10DividendAgendaHtml`
- `normalizeAgendaDate`
- `parseAgendaDate`

## O que o Proxy passa a entregar
As rotas retornam os eventos em aliases compatíveis:
- `events`
- `items`
- `dividends`
- `dividendos`
- `proventos`
- `historico`
- `history`
- `agendaEvents`
- `upcomingEvents`
- `historyEvents`
- `upcomingCount`
- `agendaDiagnostics`

## Datas suportadas
- `DD/MM/YYYY`
- `DD/MM/YY`, normalizado para `DD/MM/YYYY`.

## Endpoints reforçados
- `/api/v1/asset/dividends?ticker=PETR4&includeUpcoming=1&mode=complete`
- `/api/v1/asset/next-dividend?ticker=PETR4&includeUpcoming=1&mode=complete`
- `/api/v1/portfolio/dividends?tickers=PETR4,HGLG11&includeUpcoming=1&includeHistory=1&mode=complete`
- `/api/v1/portfolio/next-dividends?tickers=PETR4,HGLG11&includeUpcoming=1&includeHistory=1&mode=complete`

## Política de dados
O Proxy não inventa agenda futura. Ele usa:
1. agenda geral do Investidor10;
2. histórico real da página do ativo;
3. aliases compatíveis para o APK;
4. diagnóstico quando a agenda não puder ser capturada.

## Validação
Executado:

```bash
npm run check
```

Resultado:

```text
Checked 291 JS files
```

Executado:

```bash
VALORAE_TEST_TIMEOUT_MS=20000 npm test
```

Resultado:

```text
VALORAE test runner: 91 arquivos executados; falhas=0; lentos=nenhum
```

## Versão final
`21.12.65-valorae-i10-dividend-agenda-parser-boundary-fix`

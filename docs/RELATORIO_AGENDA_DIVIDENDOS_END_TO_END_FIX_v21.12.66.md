# Relatório — VALORAE Proxy v21.12.66 — Agenda Dividendos End-to-End Fix

## Diagnóstico real

A falha não estava restrita ao parser. Foram encontrados três pontos capazes de deixar as telas do APK vazias:

1. O parser v21.12.65 ainda podia deslocar valores em cards compactos do Investidor10, porque procurava `R$` depois do ticker mesmo quando o layout real vinha como `R$ valor + TICKER`.
2. As rotas de carteira dependiam de `ValoraeEngine.fetchAtivosBatch()`. Se a coleta de dados do ativo falhasse ou viesse vazia, eventos válidos da agenda eram descartados.
3. As rotas por ativo dependiam de `ValoraeEngine.fetchAtivo()`. Se a página do ativo falhasse, a agenda do Investidor10 não era retornada mesmo quando a página de dividendos geral estava disponível.

## Arquivos alterados

- `lib/market/investidor10-dividend-agenda.js`
- `routes/portfolio/dividends.js`
- `routes/portfolio/next-dividends.js`
- `routes/asset/dividends.js`
- `routes/asset/next-dividend.js`
- `routes/integration/manifest.js`
- `routes/release/readiness.js`
- `lib/observability/server-metrics.js`
- `metadata.json`
- `package.json`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `public/server.html`
- `public/index.html`
- `test/investidor10-dividend-agenda-v21-12-63.test.js`
- testes de release com allowlist atualizada para `21.12.66`

## Correção do parser

O parser agora trata três layouts:

1. Layout compacto dominante: `R$ valor + TICKER + Data Com + Pgto`.
2. Layout indexado com logo: `Logo TICKER + Data Com + Pgto + tipo + R$ valor`.
3. Layout com linhas preservadas.

A segmentação principal passou a usar a unidade `R$ valor + ticker`, impedindo que o valor de um card atravesse para o próximo ticker.

## Correção das rotas

As rotas de portfolio agora usam tickers solicitados como fonte principal da resposta e tratam `fetchAtivosBatch()` como enriquecimento opcional. Se a coleta do ativo falhar, a rota ainda retorna eventos reais da agenda para os tickers solicitados.

As rotas por ativo também passaram a tratar `fetchAtivo()` como enriquecimento. A falha do dashboard do ativo não bloqueia mais a agenda geral do Investidor10.

## Validação específica

Simulação com cards compactos consecutivos:

```text
05/06/26 Dividendos R$ 0,62 FISC11 Data Com 05/06/26 Pgto 15/06/26
05/06/26 Dividendos R$ 0,80 FATN11 Data Com 05/06/26 Pgto 15/06/26
```

Resultado correto:

```text
FISC11 -> 0.62
FATN11 -> 0.80
```

Também foi validado que `/portfolio/next-dividends` continua retornando agenda mesmo quando `fetchAtivosBatch()` falha.

## Comandos executados

```bash
node --check lib/market/investidor10-dividend-agenda.js
node --check routes/portfolio/dividends.js
node --check routes/portfolio/next-dividends.js
node --check routes/asset/dividends.js
node --check routes/asset/next-dividend.js
node scripts/audit-version-consistency.js
npm test -- --runInBand
```

Resultado:

```text
VALORAE test runner: 91 arquivos executados; falhas=0
```

## Versão

- Core semver preservado: `21.12.0`
- Release interna: `21.12.66-valorae-i10-dividend-agenda-end-to-end-fix`

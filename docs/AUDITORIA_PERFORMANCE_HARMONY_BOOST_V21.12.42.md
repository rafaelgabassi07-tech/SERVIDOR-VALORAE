# Auditoria e otimização — VALORAE v21.12.42 Final Audit Corrections

## Objetivo

Continuar a potencialização de extração e desempenho sem quebrar o ecossistema VALORAE, preservando:

- `lib/Valorae-engine.js` como núcleo central;
- compatibilidade com Vercel/GitHub Free;
- nenhum Redis/KV/banco/storage obrigatório;
- Monitor do Proxy em harmonia com API, Engine e app consumidor.

## Correções e melhorias aplicadas

### 1. Hedge StatusInvest para modo turbo/deep

O modo `profile=turbo`/`profile=deep` agora pode preparar StatusInvest em paralelo quando a extração principal tende a precisar de complemento. Isso reduz a latência percebida nos casos em que Investidor10/seletores rápidos vêm pobres e o motor precisaria buscar uma segunda fonte depois.

Controle por env/query:

```env
VALORAE_HEDGED_STATUSINVEST_ENABLED=true
```

ou:

```text
/api/v1/asset?ticker=PETR4&view=app&profile=turbo&hedgedStatusInvest=1
```

### 2. Monitor do Proxy em harmonia com o ecossistema VALORAE

O Monitor agora entende sinais específicos de extração dentro de `payloadSignals`:

- `performanceProfile`
- `extractionCompletenessScore`
- `extractionCompletenessThreshold`
- `extractionComplete`
- `extractionMissingCriticalFields`
- `adaptiveCompletionAttempted` / `adaptiveCompletionOk`
- `statusInvestComplementAttempted` / `statusInvestComplementOk`
- `statusInvestHedged` / `statusInvestHedgeOk`
- `bestSnapshotHydrated`
- `yahooPrefetch`

Esses campos aparecem na página **Saída do Proxy** e em **Qualidade dos dados**, evitando que o painel mostre apenas `PARTIAL`/`OK` sem explicar o que aconteceu.

### 3. Dedupe de batch/carteira

`fetchAtivosBatch` agora deduplica tickers repetidos internamente, mas preserva a quantidade e ordem de saída para o app. Em carteiras/watchlists com tickers repetidos, isso evita trabalho duplicado e melhora latência.

Controle:

```env
VALORAE_BATCH_DEDUPE_ENABLED=true
```

ou desativação por chamada:

```text
dedupeBatch=0
```

### 4. Cache e perfil mais transparentes

`performanceCapabilities()` agora documenta:

- `hedgedStatusInvest=1|0`
- `dedupeBatch=1|0`
- `profile=turbo|max|complete`

O perfil `turbo` registra explicitamente `hedgedStatusInvest` nos hints e na telemetria.

### 5. Sincronização de release

Foram sincronizados:

- `metadata.json`
- `package.json` / `valorae.releasePatch`
- PWA manifest
- Service Worker cache `valorae-proxy-server-v21-12-42`
- `/api/v1/integration/manifest`
- `/api/v1/release/readiness`
- OpenAPI audit string
- Monitor `public/server.html` e `public/index.html`

## Benchmarks locais/mocados

### `npm run bench:scrape`

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| fast-selectors-single-pass | 1.566 ms | 1.311 ms | 2.544 ms |
| custom-selectors-css-lite | 2.499 ms | 2.248 ms | 4.152 ms |
| signature-result-key | 0.022 ms | 0.018 ms | 0.032 ms |
| signature-fetch-key | 0.007 ms | 0.004 ms | 0.009 ms |

### `npm run bench:turbo`

| Caso | Média | Mediana | P95 | Status | Partial | Score |
|---|---:|---:|---:|---|---|---:|
| turbo-complement-no-result-cache | 26.312 ms | 21.469 ms | 32.084 ms | OK | false | 86 |
| turbo-result-cache-hit | 0.840 ms | 0.716 ms | 0.891 ms | OK | false | 86 |

Hit rate do cache de resultado no benchmark turbo: **96.15%**.

## Validações executadas

Passaram:

- `npm run check`
- `npm test`
- `npm run build`
- `npm run build:strict`
- `npm run typecheck`
- `npm run smoke`
- `npm run audit:complete-polish`
- `npm run audit:visual-polish`
- `npm run audit:engine-core`
- `npm run audit:engine-modules`
- `npm run audit:engine-performance`
- `npm run audit:routes`
- `npm run audit:release`
- `npm run audit:free`
- `npm run audit:final`
- `npm run audit:version`
- `npm run bench:scrape`
- `npm run bench:turbo`
- `npm audit --omit=dev`: 0 vulnerabilidades

## Observações de produção

- `profile=fast` continua recomendado para listas grandes e uso de baixa latência.
- `profile=turbo` é recomendado para detalhe individual de ativo, tela principal do app ou atualização manual.
- O hedge aumenta chance de completar dados mais cedo, mas pode abrir chamada paralela a StatusInvest em perfis turbo/deep. Continua free-only e sem infraestrutura paga.
- `PARTIAL` ainda pode ocorrer se todas as fontes externas falharem, bloquearem ou mudarem HTML, mas o payload agora explica melhor a causa e o Monitor mostra os complementos usados.

## Veredito

A v21.12.42 é uma evolução direta da v21.12.41: mantém o turbo, melhora a velocidade em cenários incompletos, reduz trabalho duplicado em batch e deixa o Monitor do Proxy mais alinhado ao ecossistema VALORAE.

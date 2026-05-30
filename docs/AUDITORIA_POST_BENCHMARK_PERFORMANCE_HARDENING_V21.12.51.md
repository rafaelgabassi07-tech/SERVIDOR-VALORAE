# VALORAE v21.12.51 — Post Benchmark Performance Hardening

## Base da implementação

Esta versão aplica o checklist técnico pós-benchmark recebido em `RELATORIO_TECNICO_MELHORIAS_VALORAE_POS_BENCHMARK.md`, com foco em reduzir overhead de `/api/scrape`, corrigir métricas de batch, estabilizar concorrência e manter o release verde sem dependências externas.

## Correções P0/P1 implementadas

### 1. `/api/scrape` com fast-path de cache serializado

- Adicionada camada de response cache preparada/serializada em `lib/cache/scrape-result-cache.js`.
- Adicionado `sendPreparedJson` em `lib/performance/http.js` para retorno direto de JSON já preparado.
- Cache hit quente agora evita fetch, parse, extração, shape pesado e serialização completa.
- Header de cache passa a indicar `RESULT_RESPONSE_HIT` quando o retorno usa a camada ultrarrápida.

### 2. Novo perfil `profile=scrape-fast`

- Adicionado em `lib/scrape/scrape-input.js`.
- Desativa gráficos e diagnóstico profundo por padrão.
- Mantém resultados, métricas essenciais e cobertura coerente.
- Ideal para integrações simples, probes e rotas que só precisam de seletores.

### 3. Coalescing de fetch concorrente em `/api/scrape`

- A rota agora usa `coalesce(buildFetchKey(...))`.
- 25 chamadas simultâneas idênticas passam a compartilhar 1 fetch real.
- Isso evita o caso de concorrência com respostas inconsistentes e reduz custo sob rajadas.

### 4. Batch com métricas lógicas e de execução

`/api/batch-scrape` agora separa:

```json
{
  "logical": {
    "inputCount": 20,
    "uniqueRequestKeys": 1,
    "dedupedCount": 19
  },
  "execution": {
    "networkFetches": 0,
    "parseRuns": 0,
    "selectorRuns": 0,
    "resultCacheHits": 20
  },
  "coalescing": {
    "byUrl": true,
    "byResultKey": true,
    "servedFromCache": true
  }
}
```

Isso corrige o problema de métricas enganarem quando todos os itens vinham do cache.

### 5. `extractionCoveragePercent` limitado a 100

- `coveragePercent` agora fica em 0–100.
- Quando for necessário indicar excesso de cobertura, o payload também expõe `coverageRatio`.

### 6. Métricas de handler

Foram adicionadas/normalizadas métricas como:

- `validationMs`
- `cacheLookupMs`
- `engineTimeMs`
- `shapeTimeMs`
- `serializeTimeMs`
- `handlerTotalMs`
- `responseBytes`

### 7. Teste regressivo novo

Novo arquivo:

```txt
test/post-benchmark-hardening-v21-12-51.test.js
```

Ele valida:

- cache serializado em `/api/scrape`;
- `fields` alterando chave de cache;
- 25 chamadas concorrentes com 1 fetch real;
- batch 20 duplicados cold/hot preservando métricas lógicas;
- cobertura limitada a 100;
- `scrape-fast` sem `chartSeries` por padrão.

## Benchmark controlado v21.12.51

Comando:

```bash
npm run bench:post-benchmark
```

Resultado:

| Caso | Resultado |
|---|---:|
| `/api/scrape profile=scrape-fast` cold | 27.581 ms |
| `/api/scrape profile=scrape-fast` hot média | 0.646 ms |
| `/api/scrape profile=scrape-fast` hot mediana | 0.310 ms |
| `/api/scrape profile=scrape-fast` hot P95 | 2.104 ms |
| 25 chamadas concorrentes mesma URL | 25/25 OK |
| Fetch real em 25 concorrentes | 1 |
| Batch 20 duplicados cold | 10.673 ms |
| Batch 20 duplicados hot | 6.253 ms |
| Batch hot resultCacheHits | 20 |

## Comparação com metas do relatório pós-benchmark

| Meta | Resultado v21.12.51 |
|---|---:|
| `/api/scrape` hot média < 3 ms | OK — 0.646 ms |
| `/api/scrape` hot P95 < 6 ms | OK — 2.104 ms |
| Batch 20 duplicados < 60 ms | OK — 10.673 ms cold / 6.253 ms hot |
| 25 concorrentes mesma URL com fetchCount 1 | OK — fetches 1 |
| 25 concorrentes todas OK | OK — 25/25 |
| `coveragePercent <= 100` | OK |
| Zero dependências npm | OK |
| Gradle na raiz | OK — nenhum artefato encontrado |

## Validações executadas

- `npm run check` — 273 arquivos JS.
- `npm test` — OK.
- `npm run build` — OK.
- `npm run build:strict` — OK.
- `npm run typecheck` — OK.
- `npm run smoke` — OK.
- `npm run audit:free` — OK.
- `npm run audit:version` — OK.
- `npm run audit:routes` — OK.
- `npm run audit:release` — OK.
- `npm run audit:final` — OK.
- `npm run audit:engine-performance` — OK.
- `npm run audit:complete-polish` — OK.
- `npm run audit:visual-polish` — OK.
- `npm run audit:engine-core` — OK.
- `npm run audit:engine-modules` — OK.
- `npm run bench:scrape` — OK.
- `npm run bench:turbo` — OK.
- `npm run bench:stale-budget` — OK.
- `npm run bench:canonical` — OK.
- `npm run bench:post-benchmark` — OK.
- `npm audit --omit=dev` — 0 vulnerabilidades.

Observação: `npm run verify` foi iniciado, mas nesta sessão excedeu o limite de tempo da ferramenta durante a repetição da suíte completa. Os blocos internos do verify foram executados separadamente e passaram.

## Conclusão

A versão v21.12.51 fecha os principais pontos do relatório pós-benchmark sem adicionar dependências, sem recursos pagos e preservando o `lib/Valorae-engine.js` como núcleo central. O ganho mais expressivo foi no caminho quente de `/api/scrape`, que passou a responder em sub-milissegundos/milisegundos baixos quando a resposta preparada está em cache.

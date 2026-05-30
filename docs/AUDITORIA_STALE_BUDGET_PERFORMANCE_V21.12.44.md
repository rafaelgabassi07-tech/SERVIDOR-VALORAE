# VALORAE Proxy v21.12.45 — Final Audit Corrections

## Objetivo

Continuar a potencialização de extração e desempenho da v21.12.43, mantendo o Monitor do Proxy em harmonia com o ecossistema VALORAE, sem dependências pagas, sem Redis/KV/banco e sem desmembrar `lib/Valorae-engine.js`.

## Veredito

A versão v21.12.45 está aprovada para uso pessoal e é a versão recomendada após esta rodada.

Ela não tenta prometer extração completa quando todas as fontes externas falham, mas melhora o comportamento do app em três cenários críticos:

1. fontes lentas ou instáveis;
2. chamadas com `timeoutMs` curto para cards/listas/carteira;
3. resposta final já existente em cache, mas expirada dentro da janela stale.

## Correções e melhorias aplicadas

### 1. Cache stale realmente funcional

Na v21.12.43, o cache final tinha `stale-if-error`, mas havia um detalhe: quando a entrada expirava, a primeira busca sem `allowStale` podia apagar o item antes que a segunda etapa tentasse usá-lo como stale.

Agora, se a entrada expirou, mas ainda está dentro de `staleUntil`, ela é preservada. Isso permite:

- `stale-if-error` real;
- resposta protegida quando a fonte externa falha;
- menor chance de tela vazia ou `PARTIAL` depois de uma extração boa.

### 2. Stale-while-revalidate para baixa latência

Chamadas com orçamento curto podem retornar o último payload bom imediatamente enquanto a instância quente tenta atualizar em segundo plano.

Novo comportamento:

- `timeoutMs <= 1000` ativa baixa latência;
- se existir payload stale bom, ele é entregue sem bloquear a UI;
- o refresh ocorre best-effort na instância atual;
- o payload recebe `cacheStatus: RESULT_CACHE_STALE_WHILE_REVALIDATE` quando aplicável.

### 3. Orçamento de timeout propagado para mais camadas

A v21.12.43 já tinha corrigido grande parte do problema de `timeoutMs`, mas ainda havia camadas com timeout próprio. A v21.12.45 reforça o orçamento em:

- ValoraeScrape;
- DirectFetch;
- Yahoo Chart;
- Google News;
- APIs internas do Investidor10;
- complemento adaptativo;
- StatusInvest complementar;
- hedge StatusInvest.

### 4. Menos retries em baixa latência

Quando o app pede resposta rápida, o engine reduz retries e sleeps desnecessários.

Isso protege:

- cards;
- listas;
- carteira;
- monitor;
- telas que não podem ficar esperando uma extração profunda.

### 5. `/api/assets` também ganhou baixa latência

A rota de múltiplos ativos agora respeita melhor o mesmo orçamento de baixa latência usado em `/api/asset`.

Em `timeoutMs <= 1000`, sem `complete=1`, ela evita HTML pesado, APIs internas e complementos profundos, preservando a fluidez do app.

### 6. Novos controles free-only

Adicionados em `.env.example`:

```env
VALORAE_LOW_LATENCY_BUDGET_MS=1000
VALORAE_MIN_NETWORK_TIMEOUT_MS=350
```

Esses controles não dependem de serviços pagos.

### 7. Novo benchmark

Adicionado:

```bash
npm run bench:stale-budget
npm run bench:latency
```

Arquivo gerado pelo benchmark:

```text
reports/benchmark-stale-budget-v21.12.45.json
```

### 8. Novo teste regressivo

Adicionado:

```text
test/timeout-performance-guard-v21-12-45.test.js
```

Ele valida:

- propagação de `timeoutMs`;
- base URL local `http://localhost`/`127.0.0.1`;
- baixa latência;
- preservação do cache stale;
- entrega stale-while-revalidate.

## Benchmarks

### Benchmark stale budget

| Caso | Média | Mediana | P95 | Status |
|---|---:|---:|---:|---|
| cold-fresh-fill | 102.481 ms | 102.481 ms | 102.481 ms | OK, `partial=false` |
| stale-while-revalidate-low-latency | 1.910 ms | 0.645 ms | 12.777 ms | OK, `partial=false` |

O benchmark registrou `staleHits: 6`, `inflightJoins: 4` e sem vulnerabilidades de dependência.

### Benchmark scrape

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| fast-selectors-single-pass | 1.516 ms | 1.337 ms | 2.684 ms |
| custom-selectors-css-lite | 2.540 ms | 2.372 ms | 3.438 ms |
| signature-result-key | 0.036 ms | 0.033 ms | 0.045 ms |
| signature-fetch-key | 0.011 ms | 0.008 ms | 0.014 ms |

### Benchmark turbo

| Caso | Média | Mediana | P95 | Resultado |
|---|---:|---:|---:|---|
| turbo-complement-no-result-cache | 26.917 ms | 22.260 ms | 31.617 ms | OK, `partial=false`, score 86 |
| turbo-result-cache-hit | 0.837 ms | 0.703 ms | 1.067 ms | OK, `partial=false`, score 86 |

## Validações executadas

Passaram:

- `npm run check` — 256 arquivos JS validados;
- `npm test`;
- `npm run build`;
- `npm run build:strict`;
- `npm run typecheck`;
- `npm run smoke`;
- `npm run audit:complete-polish`;
- `npm run audit:visual-polish`;
- `npm run audit:engine-core`;
- `npm run audit:engine-modules`;
- `npm run audit:engine-performance`;
- `npm run audit:routes`;
- `npm run audit:release`;
- `npm run audit:free`;
- `npm run audit:final`;
- `npm run audit:version`;
- `npm run bench:scrape`;
- `npm run bench:turbo`;
- `npm run bench:stale-budget`;
- `npm audit --omit=dev` — 0 vulnerabilidades.

## Como usar no app

Para listas/cards/carteira:

```text
/api/v1/asset?ticker=PETR4&view=app&profile=fast&timeoutMs=500
/api/v1/assets?tickers=PETR4,VALE3,GARE11&view=app&profile=portfolio&timeoutMs=800
```

Para detalhe com boa completude:

```text
/api/v1/asset?ticker=PETR4&view=app&profile=turbo
```

Para máxima completude:

```text
/api/v1/asset?ticker=PETR4&view=app&profile=max&complete=1
```

## Conclusão

A v21.12.45 melhora a performance percebida e a resiliência do app sem trocar a arquitetura. O VALORAE continua compatível com Vercel Free e preserva `lib/Valorae-engine.js` como núcleo central.

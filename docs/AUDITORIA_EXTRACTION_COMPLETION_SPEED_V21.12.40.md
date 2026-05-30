# Auditoria e correção — VALORAE v21.12.40 Extraction Completion Speed

## Objetivo

Reduzir respostas `PARTIAL` nas extrações financeiras sem transformar todas as chamadas em modo pesado, mantendo compatibilidade com Vercel Free, uso pessoal e o arquivo `lib/Valorae-engine.js` como núcleo central.

## Diagnóstico

O `PARTIAL` aparecia principalmente quando:

1. perfis rápidos (`view=app`, `profile=fast`, `compact`) priorizavam seletores e evitavam HTML completo;
2. a fonte retornava poucos seletores úteis;
3. o Yahoo/quote fallback preenchia apenas cotação e variação;
4. não havia último snapshot bom em memória para reaproveitar campos reais.

Esse comportamento era seguro, mas deixava o app com telas incompletas quando a fonte ao vivo falhava ou vinha pobre.

## Correções implementadas

### 1. Complemento adaptativo anti-PARTIAL

Adicionada a etapa `adaptiveCompletion`:

- perfis rápidos continuam leves por padrão;
- se a extração rápida não atinge a meta mínima de campos, o engine faz uma tentativa curta de HTML completo;
- o complemento só roda quando necessário;
- o diagnóstico aparece em `metrics.extractionCompleteness.adaptiveCompletion`.

Parâmetros disponíveis:

```text
complete=1
adaptiveCompletion=1|0
adaptiveCompletionTimeoutMs=1000..12000
```

### 2. Último snapshot real do ativo

Adicionado cache em memória `bestSnapshot` por ticker/tipo:

- armazena o melhor payload real visto na instância;
- quando a fonte ao vivo falha, preenche apenas campos ausentes;
- não inventa dados;
- não substitui valores frescos;
- evita que uma resposta vazia apague a tela do app.

O diagnóstico aparece em:

```text
bestSnapshotHydration
metrics.extractionCompleteness.bestSnapshotHydration
/api/v1/source/status -> caches.bestSnapshot
```

### 3. Prefetch de Yahoo Chart

A cotação Yahoo agora pode iniciar em paralelo com a busca HTML, reduzindo tempo total quando a cotação é usada para completar preço/variação.

### 4. Diagnóstico exposto no app

`view=app` agora preserva informações enxutas de completude:

```text
extractionCompleteness
bestSnapshotHydration
metrics.extractionCompleteness
```

Assim o APK/Web consegue saber se a resposta veio completa, complementada ou hidratada de snapshot real.

### 5. OpenAPI e perfis atualizados

O OpenAPI agora documenta `complete`, `adaptiveCompletion` e `adaptiveCompletionTimeoutMs`.

## O que isso resolve

- Reduz `PARTIAL` causado por seleção rápida pobre.
- Melhora a chance de resposta completa em `profile=fast`.
- Evita tela vazia quando uma fonte externa falha após uma extração boa anterior.
- Mantém `instant` e `portfolio` leves por padrão.
- Preserva uso gratuito e sem banco externo.

## O que isso não promete

Não há como garantir 100% de extração completa se todas as fontes públicas bloquearem, mudarem HTML ou ficarem fora. Nesses casos, o sistema agora degrada melhor: usa snapshot real, exibe diagnóstico claro e evita apagar dados bons.

## Benchmarks locais/mocados

Arquivo gerado:

```text
reports/benchmark-extraction-completion-v21.12.40.json
```

Resultados principais:

| Caso | Média | Mediana | P95 | Resultado |
|---|---:|---:|---:|---|
| adaptive-completion-selector-poor-to-ok | 16.255 ms | 11.987 ms | 23.285 ms | `OK`, `partial=false`, 16 campos |
| best-snapshot-hydration-no-live-source | 19.207 ms | 18.692 ms | 24.681 ms | `OK`, `partial=false`, 16 campos |

Benchmark nativo de seletores:

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| fast-selectors-single-pass | 1.655 ms | 1.507 ms | 2.477 ms |
| custom-selectors-css-lite | 2.828 ms | 2.684 ms | 3.723 ms |
| signature-result-key | 0.028 ms | 0.019 ms | 0.038 ms |
| signature-fetch-key | 0.007 ms | 0.005 ms | 0.010 ms |

## Validações executadas

Passaram:

- `npm run check`
- `npm test` em blocos completos
- `npm run build`
- `npm run build:strict`
- `npm run typecheck`
- `npm run smoke`
- `npm run audit:complete-polish`
- `npm run audit:visual-polish`
- `npm run audit:engine-core`
- `npm run audit:engine-modules`
- `npm run audit:engine-performance`
- `npm run audit:version`
- `npm run audit:release`
- `npm run audit:routes`
- `npm run audit:final`
- `npm run bench:scrape`
- `npm audit --omit=dev`

## Veredito

A v21.12.40 é a melhor versão para lançamento pessoal até agora quando o objetivo é reduzir `PARTIAL` e melhorar velocidade percebida de extração.

Recomendação de uso:

```text
/api/v1/asset?ticker=PETR4&view=app&profile=fast
```

Para uma tela de detalhe onde você quer máxima completude:

```text
/api/v1/asset?ticker=PETR4&view=app&profile=fast&complete=1
```

Para auditoria profunda:

```text
/api/v1/asset?ticker=PETR4&view=full&profile=deep
```

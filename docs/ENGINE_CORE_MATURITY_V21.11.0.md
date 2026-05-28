# VALORAE Proxy v21.11.0 — Engine Core Maturity

Esta rodada continua a evolução da v21.11.6 com foco no núcleo do `Valorae-engine.js`, performance de scraping, precisão da extração e leitura dos gráficos do painel servidor.

## Melhorias aplicadas

### 1. Classificação profunda de erros

Criado `lib/resilience/error-classifier.js` para classificar falhas em tipos operacionais:

- `TIMEOUT`
- `DNS_ERROR`
- `TLS_ERROR`
- `NETWORK_ERROR`
- `HTTP_403`
- `HTTP_404`
- `HTTP_429`
- `HTTP_5XX`
- `INVALID_CONTENT_TYPE`
- `WAF_DETECTED`
- `EMPTY_HTML`

O Engine agora consegue indicar se uma falha é transitória ou final, o que melhora retry, circuit breaker, dashboard e explicações para o app consumidor.

### 2. Retry inteligente no DirectFetch

`fetchPublicHtml` ganhou retry leve e controlado por `VALORAE_DIRECT_FETCH_RETRIES`, sem custos obrigatórios e sem dependências.

Repetição ocorre apenas em falhas transitórias. Erros finais, como host inválido, 403/404 definitivos ou content-type inválido, evitam insistência desnecessária.

### 3. Precisão de extração

Criado `lib/quality/extraction-precision.js` para gerar um relatório barato e didático:

- score de precisão;
- nível de confiança;
- cobertura dos seletores;
- chaves vazias;
- validação de valores numéricos em formato PT-BR;
- detecção de valores suspeitos;
- prontidão para gráficos.

`/api/scrape` e `/api/batch-scrape` agora retornam `precision` e `chartReadiness` quando houver extração.

### 4. Fast selectors mais úteis

`lib/scrape/fast-selectors.js` agora suporta extrações rápidas para:

- `number`;
- `numeric`;
- `percent`;
- `content`.

Também remove duplicidades por seletor e expõe cobertura do fast-path. Isso melhora performance e precisão em campos como preço, DY, P/VP, percentuais e meta tags.

### 5. Payload mobile com `fields=` real

`lib/http/response-shape.js` agora aplica `fields=` de verdade, mantendo metadados mínimos obrigatórios:

```txt
fields=results,metrics
fields=results,precision,chartReadiness
compact=1&previewChars=0
```

Isso reduz payload para APK/Web e permite respostas mais enxutas para gráficos.

### 6. Engine Core no dashboard

`/api/server/metrics` agora inclui `engine` e `engineCore`, derivados de `getValoraeRuntimeStats()`.

O dashboard ganhou leitura em tempo real para:

- score do núcleo;
- estado do Engine;
- hit rate do HTML cache;
- hit rate do scrape result cache;
- in-flight atual;
- fontes degradadas;
- recomendações operacionais.

### 7. Runtime stats mais profundo

`getValoraeRuntimeStats()` agora expõe `engineCore`, permitindo ao painel mostrar o estado interno do Engine sem fazer chamadas externas.

## Garantias preservadas

- `Valorae-engine.js` continua sendo o núcleo central.
- Não foram adicionadas dependências npm obrigatórias.
- Não há Redis, banco, KV, WebSocket, cron, filas ou serviço pago.
- `/api/server/metrics` continua isolado da telemetria real.
- O Service Worker continua ignorando `/api`.
- Compatibilidade com Vercel Free preservada.

## Novos testes/auditorias

- `test/extraction-precision-v21-11-0.test.js`
- `scripts/audit-engine-core-v21-11-0.js`
- `npm run audit:engine-core`

## Variáveis novas

```txt
VALORAE_DIRECT_FETCH_RETRIES=1
VALORAE_CIRCUIT_FAILURE_THRESHOLD=4
VALORAE_CIRCUIT_COOLDOWN_MS=300000
```

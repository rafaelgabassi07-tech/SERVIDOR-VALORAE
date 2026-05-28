# VALORAE Engine Performance & Precision — v21.11.4

Esta versão aprofunda o `Valorae-engine.js` e seus módulos auxiliares sem desmembrar o núcleo central. O foco foi reduzir trabalho repetido, melhorar precisão numérica e deixar os dados mais próprios para gráficos e apps consumidores.

## O que mudou

### 1. Normalização financeira central

Novo módulo:

```txt
lib/normalizers/numbers.js
```

Ele centraliza leitura de valores financeiros em PT-BR/EN:

- `R$ 1.234,56`
- `US$ 1,234.56`
- `2,5 milhões`
- `1.2B`
- percentuais positivos/negativos
- negativos entre parênteses

O objetivo é evitar que cada extrator tenha sua própria lógica numérica divergente.

### 2. Política adaptativa do Engine

Novo módulo:

```txt
lib/resilience/engine-policy.js
```

O Engine agora calcula um plano operacional antes de chamar provedores:

- ordem de provedores;
- orçamento de retry;
- preferência por stale quando a fonte está degradada;
- modo conservador quando o score da fonte cai.

Isso reduz custo em Vercel Free e evita insistência desnecessária em fontes problemáticas.

### 3. Failure cache curto

Novo módulo:

```txt
lib/resilience/failure-cache.js
```

Quando uma fonte falha, o Engine guarda por poucos segundos uma resposta negativa. Chamadas idênticas logo em seguida não martelam a fonte novamente. Isso protege o proxy durante instabilidade, 429, 5xx ou manutenção.

### 4. Séries normalizadas para gráficos

Novo módulo:

```txt
lib/quality/chart-series.js
```

As respostas de `/api/scrape` e `/api/batch-scrape` agora podem carregar `chartSeries` quando há dados suficientes. A série inclui pontos normalizados e resumo como mínimo, máximo, primeiro, último e variação percentual.

### 5. Fast selectors e custom selectors mais eficientes

- Fast selectors deduplicam seletores idênticos dentro da mesma chamada.
- Custom selectors têm cache local de fragmentos por seletor.
- Ambos usam a normalização financeira central.

## Garantias preservadas

- Sem Redis.
- Sem banco.
- Sem KV.
- Sem WebSocket.
- Sem filas.
- Sem cron.
- Sem serviços pagos.
- Sem dependências npm obrigatórias.
- Compatível com Vercel gratuito.
- `Valorae-engine.js` preservado como núcleo central.
- `/api/server/metrics` continua isolado da telemetria real.

## Novas variáveis opcionais

```txt
VALORAE_FAILURE_CACHE_ENABLED=true
VALORAE_FAILURE_CACHE_TTL_MS=12000
VALORAE_FAILURE_CACHE_MAX_ENTRIES=80
VALORAE_ENGINE_STALE_PREFER_SCORE=45
VALORAE_ENGINE_CONSERVATIVE_SCORE=62
VALORAE_ENGINE_DISABLE_DIRECT_RETRY=false
```

Todas possuem fallback seguro.

## Testes novos

```txt
test/engine-performance-precision-v21-11-2.test.js
scripts/audit-engine-performance-v21-11-2.js
```


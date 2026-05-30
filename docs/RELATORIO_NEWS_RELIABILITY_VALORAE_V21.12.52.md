# VALORAE Proxy v21.12.52 — News Reliability Upgrade

## Objetivo

Corrigir e endurecer com urgência a camada de notícias do VALORAE antes da integração com o APK de carteira de investimentos.

A v21.12.51 já expunha `/api/news` e `includeNews=1`, mas havia um problema semântico importante: RSS vazio/malformado podia ser tratado como `ok=true` com lista vazia. Isso poderia fazer o app apagar notícias boas ou renderizar um bloco aparentemente válido, mas sem conteúdo.

## Veredito

A v21.12.52 corrige a camada de notícias e está aprovada para uso no APK como bloco opcional.

Notícias continuam dependendo de fonte externa pública, então não devem ser tratadas como dado crítico. Agora, quando a fonte falha, o contrato orienta o app a manter a última lista boa.

## Correções aplicadas

### 1. RSS vazio não é mais sucesso falso

Antes, um RSS sem itens úteis podia voltar como:

```json
{
  "ok": true,
  "items": []
}
```

Agora volta como:

```json
{
  "ok": false,
  "empty": true,
  "code": "GOOGLE_NEWS_EMPTY",
  "appPolicy": {
    "canReplacePreviousNews": false,
    "shouldKeepPreviousNews": true,
    "optionalBlock": true
  }
}
```

### 2. RSS malformado/sem item útil fica seguro para o APK

Quando o RSS vier sem link, sem item válido ou sem relevância para o ticker, o app recebe `ok=false` e orientação para preservar o cache local.

### 3. Cache e stale de notícias

Adicionado cache dedicado de notícias:

- `NEWS_CACHE_HIT` para respostas quentes.
- `NEWS_STALE_WHILE_REVALIDATE` para baixa latência.
- `NEWS_STALE_IF_ERROR` para preservar notícia boa quando a fonte falha.
- `NEWS_STALE_IF_EMPTY` para preservar notícia boa quando o RSS ao vivo vem vazio.

### 4. Contrato app-friendly

Agora o `view=app` preserva:

- `news`
- `newsStatus`
- `newsStatus.reliability`
- `newsStatus.appPolicy`

Isso facilita o APK exibir notícias no detalhe do ativo sem misturar falha de notícias com falha do ativo.

### 5. Timeout específico de notícias

Adicionado suporte a `newsTimeoutMs` em:

- `/api/news`
- `/api/v1/asset?...&includeNews=1`
- `/api/v1/assets?...&includeNews=1`

Uso recomendado:

```text
/api/v1/asset?ticker=PETR4&view=app&profile=turbo&includeNews=1&newsLimit=5&newsTimeoutMs=1500
```

### 6. Métricas de runtime

`getValoraeRuntimeStats()` agora expõe:

```json
{
  "caches": {
    "news": {
      "entries": 0,
      "ttlMs": 900000,
      "staleMs": 21600000,
      "maxEntries": 150,
      "inflight": 0,
      "metrics": {
        "hits": 0,
        "misses": 0,
        "staleHits": 0,
        "sets": 0,
        "empty": 0,
        "errors": 0,
        "evictions": 0,
        "inflightJoins": 0
      },
      "reliabilityVersion": "21.12.52-news-reliability-upgrade"
    }
  }
}
```

## Novas variáveis de ambiente

```env
VALORAE_NEWS_LIMIT=8
VALORAE_NEWS_CACHE_TTL_MS=900000
VALORAE_NEWS_CACHE_STALE_MS=21600000
VALORAE_NEWS_CACHE_MAX_ENTRIES=150
VALORAE_RATE_LIMIT_NEWS_MAX=90
```

## Novo teste regressivo

Adicionado:

```text
test/news-reliability-v21-12-52.test.js
```

Ele valida:

- RSS válido retorna `ok=true` com item.
- Cache quente retorna `NEWS_CACHE_HIT`.
- `view=app` preserva `news` e `newsStatus`.
- RSS vazio retorna `ok=false`.
- RSS malformado não substitui notícia boa.
- Falha de fetch retorna `shouldKeepPreviousNews=true`.
- `/api/news` retorna contrato com `reliability.version`.

## Novo benchmark

Adicionado:

```bash
npm run bench:news
```

Resultado local/mocado:

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| News cold | 5.805 ms | 5.124 ms | 9.043 ms |
| News hot/cache | 0.019 ms | 0.011 ms | 0.060 ms |

Semântica de RSS vazio:

```json
{
  "ok": false,
  "code": "GOOGLE_NEWS_EMPTY",
  "shouldKeepPreviousNews": true
}
```

## Validações executadas

Passaram:

- `npm run check` — 275 arquivos JS.
- `npm test` foi executado; a ferramenta interrompeu por tempo durante a suíte longa, mas os blocos restantes foram executados separadamente e passaram.
- `npm run build`
- `npm run build:strict`
- `npm run typecheck`
- `npm run smoke`
- `npm run audit:version`
- `npm run audit:routes`
- `npm run audit:release`
- `npm run audit:free`
- `npm run audit:final`
- `npm run bench:news`
- `npm run bench:post-benchmark`
- `npm run bench:scrape`
- `npm run bench:turbo`
- `npm run bench:stale-budget`
- `npm run bench:canonical`
- `npm audit --omit=dev` — 0 vulnerabilidades.

`npm run verify` também foi iniciado e passou pelo `check`, mas excedeu o tempo da ferramenta durante a repetição da suíte longa. Os comandos internos foram validados separadamente.

## Recomendação para o APK

Na carteira/lista:

```text
Não carregar notícias por padrão.
```

Na tela de detalhe:

```text
/api/v1/asset?ticker=PETR4&view=app&profile=turbo&includeNews=1&newsLimit=5&newsTimeoutMs=1500
```

Regra do app:

```text
Se newsStatus.ok=false ou newsStatus.appPolicy.shouldKeepPreviousNews=true, não apagar notícias antigas do cache local.
```

## Conclusão

Use a versão:

```text
v21.12.52-news-reliability-upgrade
```

Ela corrige o ponto urgente das notícias sem remover Investidor10, StatusInvest, Yahoo, camada canônica, gráficos, rankings, dividendos ou qualquer recurso do ecossistema VALORAE.

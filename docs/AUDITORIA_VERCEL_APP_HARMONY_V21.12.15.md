# Auditoria v21.12.15 — Harmonia Vercel ↔ Apps do ecossistema Valorae

## Objetivo

Garantir que o aplicativo visual do servidor e a função única da Vercel conversem em harmonia para exibir, no painel, as informações que saem do proxy e são distribuídas para os aplicativos consumidores do ecossistema Valorae Engine.

## Melhorias aplicadas

### 1. Telemetria de consumidores/app/canal

O observability core agora identifica consumidores por:

- `x-valorae-app`
- `x-valorae-app-version`
- `x-valorae-channel`
- `x-valorae-build`
- parâmetros `app`, `client`, `consumer`, `channel`
- fallback por `User-Agent`

Com isso, o servidor visual consegue diferenciar APK Android, Web, API/dev, watchlist, portfolio, compact/mobile e outros canais.

### 2. Delivery Harmony

Novo bloco em `/api/server/metrics`:

```json
{
  "deliveryHarmony": {
    "score": 100,
    "transformScore": 100,
    "appDeliveryScore": 100,
    "payloadsDelivered": 1,
    "renderSafePayloads": 1,
    "cacheSafePayloads": 1,
    "mobileSnapshotsDelivered": 1,
    "pipeline": []
  }
}
```

Esse bloco mede a harmonia do fluxo:

```text
Vercel Router → Proxy Capture → Valorae Engine Transform → App Contract → Dashboard Visibility
```

### 3. Painel visual atualizado

`public/server.html` e `public/index.html` agora exibem:

- Harmonia Vercel ↔ Apps
- payloads entregues
- snapshots mobile enviados
- apps/canais consumidores
- pipeline operacional
- tabela de apps recebendo dados
- entrega por rota
- evento recente com app e decisão de sync

### 4. Rotas com entrega app-aware

`routeDetails` agora inclui:

- `topApp`
- `topChannel`
- `deliveredPayloads`
- `renderSafeRatePercent`
- `cacheSafeRatePercent`
- `lastPayloadKind`
- `lastPayloadSignals`
- `metricsDelivered`
- `chartSeriesDelivered`
- `dividendRowsDelivered`

### 5. Eventos recentes enriquecidos

Cada evento externo captado pode incluir:

- app consumidor
- versão do app
- canal
- build
- decisão de entrega/sync
- presença de `appMobileSnapshot`
- presença de `appPayload`
- presença de `chartSeries`
- presença de `normalized`
- presença de `results`
- flags `renderSafe`, `cacheSafe` e `replaceSafe`

## Benefício prático para o APK/Web

O painel deixa de mostrar apenas chamadas técnicas e passa a responder:

- Qual app consumiu o proxy?
- Qual canal consumiu? watchlist, portfolio, compact, standard?
- O payload entregue era seguro para renderizar?
- O app podia substituir o cache anterior?
- Quantas métricas, gráficos e dividendos foram entregues?
- Qual rota está distribuindo informação útil?
- O Vercel/router está captando tudo sem inflar com polling interno?

## Compatibilidade

- Mantém router único `api/router.js`.
- Não depende de banco externo.
- Não depende de recurso pago da Vercel.
- Continua usando memória por instância serverless.
- Preserva `lib/Valorae-engine.js` como núcleo central.

## Teste dedicado

Adicionado:

```bash
node test/vercel-app-harmony-v21-12-15.test.js
```

Esse teste valida:

- HTML espelhado entre `/` e `/server.html`.
- presença das novas áreas visuais.
- captura de app/canal via headers.
- geração de `deliveryHarmony`.
- `renderSafe`, `cacheSafe`, snapshot mobile e decisão `replace_snapshot`.
- enriquecimento de `routeDetails` e `recentEvents`.

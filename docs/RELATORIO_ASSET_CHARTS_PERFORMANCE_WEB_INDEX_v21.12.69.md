# RELATÓRIO — Financial Charts Deep Fix v21.12.70

## Objetivo

Reduzir a latência dos dados usados pelos gráficos das abas **Desempenho & Índices** e **Finanças & Balanço** no APK VALORAE, preservando compatibilidade com o contrato `assetChartsCanonical` criado na versão anterior.

## Causa encontrada

O APK solicitava gráficos avançados usando `/api/v1/asset` em modo completo. Esse modo ativava HTML amplo, APIs internas, complementos e fallback StatusInvest. Para uma tela mobile, isso era pesado demais e podia superar 1 minuto quando combinado com chamadas duplicadas no app.

## Correções aplicadas

### 1. Novo perfil `chartfast`

Arquivo:

```text
lib/performance/profile.js
```

Foi criado o perfil de performance:

```text
chartfast
chartsfast
charts-fast
mobilecharts
mobile-charts
graficos/gráficos
```

Características:

- `timeoutMs`: 5500ms.
- `valoraeScrapeTimeoutMs`: 4500ms.
- `adaptiveCompletionTimeoutMs`: 1500ms.
- `maxHtmlChars`: 1.200.000.
- `enableInternalApis`: true.
- `returnHtml`: true.
- `adaptiveCompletion`: false.
- `statusInvestComplement`: false.
- `hedgedStatusInvest`: false.
- `resultCacheTtlMs`: 20 minutos.
- `staleResultCacheMs`: 6 horas.

### 2. Menos APIs internas por chamada mobile

Arquivo:

```text
lib/Valorae-engine.js
```

`fetchInvestidor10ApiExtras()` agora reconhece `chartfast/mobile-fast` e limita a quantidade de endpoints internos descobertos do Investidor10. Isso evita explosão de chamadas paralelas quando a página contém muitas URLs de gráficos.

### 3. Cache HTTP melhor para gráfico rápido

Arquivo:

```text
routes/asset.js
```

Respostas `chartfast`, `fast`, `portfolio` e `compact` recebem cache control leve:

```text
private, max-age=15, stale-while-revalidate=60
```

Isso favorece resposta rápida em app mobile e WebView sem comprometer endpoints completos.

### 4. Versionamento

Release patch:

```text
21.12.70-valorae-financial-charts-deep-fix
```

Também foram atualizados manifesto, service worker, readiness, métricas e testes de release.

## Validação

Comandos executados:

```bash
node --check lib/performance/profile.js
node --check lib/Valorae-engine.js
node --check routes/asset.js
node --check lib/market/investidor10-chart-extractor.js
node scripts/audit-version-consistency.js
npm run check
npm test -- --runInBand
```

Resultado:

```text
Version consistency OK: core 21.12.0; release 21.12.70-valorae-financial-charts-deep-fix.
Checked 291 JS files
VALORAE test runner: 91 arquivos executados; falhas=0; lentos=nenhum
```

## Resultado esperado

- `/api/v1/asset?ticker=PETR4&profile=chartfast&charts=mobile` responde com contrato rápido para o APK.
- O APK deixa de aguardar modo completo/max para montar gráficos.
- Cache quente e stale-while-revalidate reduzem latência percebida.
- O contrato `assetChartsCanonical` continua compatível com versões anteriores.

# RELATÓRIO — VALORAE Proxy v21.12.72 — Financial Charts Deep Fix

## Objetivo

Corrigir a extração e o contrato dos gráficos de ativos usados pelo APK VALORAE nas abas **Detalhes do Ativo**, **Desempenho & Índices** e **Finanças & Balanço**, mantendo compatibilidade com o modo rápido `chartfast` e sem quebrar agenda/proventos já corrigidos.

## Problemas investigados

1. **Lucro x Cotação**: dados podiam chegar, mas o APK desenhava em eixo absoluto único. O Proxy manteve o contrato `financial.profitVsQuote`; a correção principal foi no APK.
2. **Evolução Patrimonial**: o Investidor10/API interna pode nomear a série como `Ativo` e `Passivo` no singular. O parser só reconhecia bem `Ativos`, `Passivos`, `Ativo Total` e `Passivo Total`.
3. **Balanço Patrimonial**: mesma causa de aliases singulares e objetos diretos `{ ativo, patrimonio, passivo }`.
4. **Faturamento por região/negócio**: o Proxy extraía `revenueGeography` e `revenueSegment`, mas o contrato canônico não expunha aliases suficientes para o APK.
5. **Payout Histórico**: preservado em `financial.payoutHistory` e reforçado no APK para aceitar o caminho canônico.
6. **Rentabilidade nominal vs real**: preservada por `extractProfitabilityFromHtml` a partir do HTML do Investidor10.
7. **Comparação com índices**: o Proxy mantém normalização via `normalizeComparisonSources` e inclui fontes descobertas/embutidas.

## Arquivos alterados

- `lib/market/investidor10-chart-extractor.js`
- `lib/Valorae-engine.js`
- `lib/performance/profile.js`
- `lib/observability/server-metrics.js`
- `routes/integration/manifest.js`
- `routes/release/readiness.js`
- `metadata.json`
- `package.json`
- `public/index.html`
- `public/server.html`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `test/investidor10-complete-asset-charts-v21-12-62.test.js`
- testes de release/regex atualizados para aceitar patch `21.12.72`

## Correções técnicas

### 1. Aliases financeiros ampliados

O parser agora reconhece:

- `Ativo`, `ativos`, `Ativo Total`, `totalAtivos`, `total_assets`, `assets` → `totalAssets`
- `Passivo`, `passivos`, `Passivo Total`, `totalPassivos`, `total_liabilities`, `liabilities` → `totalLiabilities`
- `Patrimônio`, `Patrimônio Líquido`, `PL`, `equity`, `netWorth` → `netWorth`

Isso evita que apenas o PL apareça e o Ativo/Passivo fiquem vazios.

### 2. Extração de JSON embutido mais robusta

`extractJsonAssignment` foi endurecido para capturar literais JSON balanceados em scripts do HTML, evitando corte precoce em objetos grandes.

### 3. Contrato canônico de faturamento

O Proxy agora expõe aliases canônicos adicionais:

```json
{
  "revenueGeography": {},
  "revenueSegment": {},
  "revenueByRegion": {},
  "revenueByBusiness": {},
  "revenueBreakdowns": {
    "geography": {},
    "region": {},
    "byRegion": {},
    "business": {},
    "byBusiness": {}
  }
}
```

## Teste novo adicionado

Foi incluído teste com séries singulares:

```js
series: [
  { name: 'Ativo', data: [990, 1200] },
  { name: 'Patrimônio Líquido', data: [440, 500] },
  { name: 'Passivo', data: [550, 700] }
]
```

E objeto direto:

```js
{
  labels: ['2023', '2024'],
  ativo: [990, 1200],
  patrimonio: [440, 500],
  passivo: [550, 700]
}
```

Critério validado:

- `totalAssets = 990`
- `netWorth = 440`
- `totalLiabilities = 550`
- `revenueBreakdowns.geography` e `revenueBreakdowns.business` preservados

## Validação

Comandos executados:

```bash
node --check lib/market/investidor10-chart-extractor.js
node --check lib/Valorae-engine.js
node --check routes/asset.js
node scripts/audit-version-consistency.js
npm test -- --runInBand
```

Resultado:

```text
Version consistency OK: core 21.12.0; release 21.12.72-valorae-final-ui-charts-news-backup-fix.
VALORAE test runner: 91 arquivos executados; falhas=0; lentos=nenhum
```

## Versão

- Core mantido: `21.12.0`
- Release patch: `21.12.72-valorae-final-ui-charts-news-backup-fix`

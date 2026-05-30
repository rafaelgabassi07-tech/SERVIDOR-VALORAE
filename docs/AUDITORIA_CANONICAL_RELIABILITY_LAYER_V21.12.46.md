# VALORAE Proxy v21.12.48 — Canonical Data Reliability Layer

Entrega gerada: `v21.12.48-monitor-responsive-settings-theme`  
Base de trabalho: v21.12.45 final audit corrections.

## Objetivo

Reduzir o impacto de `PARTIAL` sem remover nem empobrecer os dados gratuitos ricos do Investidor10 e do StatusInvest.

A mudança implementada não troca o modelo do projeto por CVM puro. Ela adiciona uma camada canônica de dados lentos/estáveis, enquanto mantém as fontes ricas gratuitas como camada de detalhes, gráficos, rankings, dividendos e indicadores.

## Estratégia implementada

### 1. CVM / Dados Abertos como base canônica

Adicionado módulo:

```text
lib/canonical/cvm-reliability-layer.js
```

Ele fornece:

- `VALORAE_CANONICAL_RELIABILITY_VERSION`
- `getCanonicalAssetSnapshot()`
- `applyCanonicalReliabilityLayer()`
- `buildDataReliabilityBlocks()`
- `canonicalReliabilityCapabilities()`

A camada canônica usa política **fill-missing-only**: ela só preenche campo ausente, nunca sobrescreve dado vivo vindo de Investidor10, StatusInvest, Yahoo ou snapshot.

### 2. Preservação de Investidor10 e StatusInvest

Investidor10 e StatusInvest continuam responsáveis por blocos ricos:

- gráficos;
- rankings;
- histórico de dividendos;
- descrições;
- indicadores complementares;
- seções do ativo;
- dados específicos de ação/FII.

A CVM/camada canônica entra apenas para reduzir lacunas em identidade e dados lentos quando a fonte viva vier pobre.

### 3. Status por blocos

Foi adicionada a raiz:

```text
dataReliability
```

Ela expõe status por bloco:

```text
identity
quote
fundamentals
dividends
charts
rankings
```

Isso permite que o app pare de tratar uma falha de cotação, gráfico ou ranking como falha do payload inteiro.

### 4. Integração com o Monitor

O Monitor passou a reconhecer os novos sinais:

- `canonicalReliabilityUsed`
- `canonicalRenderableCore`
- `dataReliabilityState`
- `dataReliabilityIdentity`
- `dataReliabilityQuote`
- `dataReliabilityFundamentals`
- `dataReliabilityDividends`
- `dataReliabilityCharts`
- `dataReliabilityRankings`

A página de qualidade também mostra o estado de Reliability por blocos.

### 5. Configuração free-only

Novas variáveis:

```env
VALORAE_CANONICAL_DATA_ENABLED=true
VALORAE_CANONICAL_SEED_ENABLED=true
VALORAE_CANONICAL_REGISTRY_JSON=
```

`VALORAE_CANONICAL_REGISTRY_JSON` permite ampliar a base local sem banco, Redis, KV ou serviço pago.

## Validações executadas

Passaram:

- `npm run check` — 264 arquivos JS.
- `npm test` — suíte comportamental completa.
- `npm run build`.
- `npm run build:strict`.
- `npm run typecheck`.
- `npm run smoke`.
- `npm run audit:version`.
- `npm run audit:routes`.
- `npm run audit:release`.
- `npm run audit:free`.
- `npm run audit:final`.
- `npm run audit:complete-polish`.
- `npm run audit:visual-polish`.
- `npm run audit:engine-core`.
- `npm run audit:engine-modules`.
- `npm run audit:engine-performance`.
- `npm run bench:scrape`.
- `npm run bench:turbo`.
- `npm run bench:stale-budget`.
- `npm run bench:canonical`.
- `npm audit --omit=dev` — 0 vulnerabilidades.

## Benchmarks principais

### Scrape local/mocado

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| fast-selectors-single-pass | 1.553 ms | 1.354 ms | 2.465 ms |
| custom-selectors-css-lite | 2.508 ms | 2.219 ms | 4.221 ms |
| signature-result-key | 0.023 ms | 0.018 ms | 0.032 ms |
| signature-fetch-key | 0.005 ms | 0.004 ms | 0.008 ms |

### Turbo

| Caso | Média | Mediana | P95 | Status |
|---|---:|---:|---:|---|
| turbo-complement-no-result-cache | 22.123 ms | 18.212 ms | 27.113 ms | OK, partial=false |
| turbo-result-cache-hit | 0.775 ms | 0.729 ms | 0.849 ms | OK, partial=false |

### Stale budget

| Caso | Média | Mediana | P95 | Status |
|---|---:|---:|---:|---|
| cold-fresh-fill | 101.445 ms | 101.445 ms | 101.445 ms | OK |
| stale-while-revalidate-low-latency | 2.057 ms | 0.702 ms | 14.252 ms | OK |

### Camada canônica

| Caso | Média | Mediana | P95 | Resultado |
|---|---:|---:|---:|---|
| canonical-layer-cold-low-data-live-source | 17.349 ms | 11.140 ms | 80.661 ms | OK, partial=false, RENDERABLE_WITH_BLOCK_STATUS |
| canonical-layer-result-cache | 0.982 ms | 0.528 ms | 1.515 ms | OK, partial=false, RENDERABLE_WITH_BLOCK_STATUS |

## Veredito

A v21.12.48 melhora a solução estrutural do `PARTIAL` sem empobrecer o VALORAE. O app passa a ter uma base canônica para dados lentos e mantém Investidor10/StatusInvest como fontes ricas de informações gratuitas.

Ainda não é possível garantir 100% de dados ao vivo quando todas as fontes externas falham, mas agora o app tem um contrato melhor: status por bloco, preenchimento canônico sem sobrescrita e orientação clara para renderizar o que está disponível sem limpar a tela.

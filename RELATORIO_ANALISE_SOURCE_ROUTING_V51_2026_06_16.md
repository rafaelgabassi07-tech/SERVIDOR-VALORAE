# Relatório — Análise source routing v51 — 2026-06-16

## Pacote

- Proxy patch: `21.12.134-analysis-source-routing-v51`
- Versão base do Proxy: `21.12.0`
- Objetivo: corrigir as pendências exibidas no fim da página de Análise quando `Histórico de Indicadores` e `Posição acionária` já existem na fonte, mas chegam por caminhos diferentes do contrato principal.

## Correções aplicadas

### Histórico de Indicadores

A rota `/api/v1/analysis` agora aceita dados reais vindos de:

- `assetChartsCanonical.company.fundamentalIndicatorHistory`
- `assetChartsCanonical.fii.fundamentalIndicatorHistory`
- `results.assetChartsCanonical.company.fundamentalIndicatorHistory`
- `results.assetChartsCanonical.fii.fundamentalIndicatorHistory`
- `sections.historicoIndicadores`
- `results.sections.historicoIndicadores`
- `sections.tables.indicadores`
- `assetChartBundle.fundamentalIndicatorHistory`
- `assetChartsMobile.fundamentalIndicatorHistory`

Também foi reforçada a leitura de linhas tabulares, incluindo arrays do tipo:

```json
[
  ["Indicador", "2025", "2024"],
  ["P/L", "4,20", "4,90"]
]
```

### Posição acionária

A rota `/api/v1/analysis` agora aceita dados reais vindos de:

- `results.sections.empresa.posicaoAcionaria`
- `sections.empresa.posicaoAcionaria`
- `assetChartsCanonical.company.ownership`
- `assetChartsCanonical.company.shareholders`
- `results.assetChartsCanonical.company.ownership`
- `results.assetChartsCanonical.company.shareholders`
- mapas key/value como `{ "Controladores": "64%", "Free Float": "36%" }`
- arrays tabulares e rows vindos da fonte

O extrator do Investidor10 também passou a montar `ownership`, `shareholders`, `posicaoAcionaria` e `sections.empresa.posicaoAcionaria` quando encontra a seção/tabela real de posição acionária no HTML.

### FIIs

O extractor canonical do Investidor10 agora encaminha corretamente `rawJson.historicoIndicadoresFii` para:

- `assetChartsCanonical.fii.fundamentalIndicatorHistory`

Isso evita que o Histórico de Indicadores de FIIs fique pendente quando a API real `/api/fii/historico-indicadores/...` responde.

## Regra real-only preservada

Nenhum valor sintético foi criado. As seções só ficam com `status: ready` quando há dados reais vindos de fonte/canonical/HTML/API. Caso a fonte não envie dados suficientes, o bloco continua sinalizado como pendente.

## Testes executados

- `npm run check` — OK, 231 arquivos JS conferidos.
- `npm test` — OK, 48 arquivos de teste, 0 falhas.
- `npm run verify` — OK.
- `npm run audit:version` — OK para `21.12.134-analysis-source-routing-v51`.

## Teste regressivo novo

Criado `test/analysis-source-pending-v51.test.js`, cobrindo:

- Histórico vindo de `results.assetChartsCanonical.company.fundamentalIndicatorHistory`.
- Posição acionária vinda de `results.assetChartsCanonical.company.ownership`.
- Posição acionária vinda de `results.sections.empresa.posicaoAcionaria`.
- Histórico de FII vindo de `rawJson.historicoIndicadoresFii`.
- Extração HTML/tabela real de `Posição acionária`.

## Prévia visual

Arquivo incluído:

- `docs/preview_analise_source_routing_v51.png`

A prévia mostra como a página deve se comportar quando as duas seções chegam como `ready`: os blocos de Histórico e Posição acionária aparecem preenchidos e o bloco “Pendências da fonte” deixa de mostrar essas duas pendências.

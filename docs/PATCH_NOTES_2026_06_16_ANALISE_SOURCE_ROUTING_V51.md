# Patch notes — 2026-06-16 — Análise source routing v51

Patch: `21.12.134-analysis-source-routing-v51`

## Objetivo

Eliminar as pendências reais exibidas no fim da página de Análise do APK quando a fonte já fornece dados de `Histórico de Indicadores` e `Posição acionária`, mas eles chegam por caminhos diferentes do contrato principal.

## Ajustes realizados

- `lib/analysis/analysis-page-response.js` agora lê histórico de indicadores em caminhos canonical de empresa/FII, sections e tabelas reais.
- `lib/analysis/analysis-page-response.js` agora lê posição acionária em `sections.empresa`, `assetChartsCanonical.company`, mapas key/value, arrays tabulares e payloads nested.
- `lib/sources/asset-details.js` passou a extrair posição acionária real do HTML/tabelas do Investidor10 e encaminhar para `ownership`, `shareholders`, `posicaoAcionaria` e `sections.empresa.posicaoAcionaria`.
- `lib/market/investidor10-chart-extractor.js` passou a encaminhar `rawJson.historicoIndicadoresFii` para `fii.fundamentalIndicatorHistory`.
- Criado `test/analysis-source-pending-v51.test.js` cobrindo as regressões principais.

## Regra mantida

Sem fallback sintético: as seções só ficam prontas quando houver dados reais de fonte/canonical/HTML/API.

# Auditoria Valorae Engine — Deep Consumer Chart Normalizer v21.12.2

## Objetivo

Aprimorar a capacidade do Valorae Proxy de transformar qualquer dado captado pelo proxy em séries prontas para consumo por painéis, APKs e gráficos, sem quebrar o contrato v21.12.0 já validado.

## Correções e melhorias aplicadas

- `lib/quality/chart-series.js` evoluído para `21.12.2-chart-series-deep-consumer-normalizer`.
- Preservado `lib/Valorae-engine.js` como núcleo central; a mudança fica em módulo auxiliar de qualidade.
- Reconhecimento de arrays OHLC comuns em fontes de mercado/Yahoo-like: `[timestamp, open, high, low, close]`, usando `close` como valor principal e mantendo metadados `ohlc` no ponto.
- Reconhecimento de mapas indexados por data, como `{ "2024-01": "R$ 10,10", "2024-02": "R$ 10,30" }`.
- Reconhecimento de arrays de objetos com múltiplos campos numéricos, gerando séries separadas para campos como `rendimento`, `preco`, `dy`, `valor`, `total`, `volume`, `pvp`, `pl` etc.
- Reconhecimento de estruturas tabulares `columns/rows`, transformando cada coluna numérica em série independente.
- `chartReadiness` passa a herdar automaticamente os novos formatos porque usa o mesmo normalizador.
- Tipagem atualizada em `lib/engine/Valorae-engine-types.ts` para pontos OHLC opcionais.
- Novo teste dedicado: `test/chart-series-deep-consumer-normalizer.test.js`.
- `npm test` agora inclui os testes ricos de séries de gráficos.

## Impacto no app consumidor

O APK/web passa a receber `chartSeries.series[]` com mais cobertura e menos necessidade de lógica própria para interpretar payloads heterogêneos. Isso melhora especialmente:

- gráficos de cotação histórica;
- gráficos de dividendos/rendimentos;
- evolução de DY, preço, lucro, receita e indicadores;
- painéis que recebem tabelas ou objetos compactados de scrapers/API.

## Validações executadas

```bash
npm run check
node test/chart-series-rich-normalizer.test.js
node test/chart-series-deep-consumer-normalizer.test.js
npm test
npm run audit:vercel-api
npm run audit:dashboard-live
npm run audit:live-endpoints
npm run build
```

Todos os comandos passaram com sucesso.

## Observação de compatibilidade

O pacote mantém o contrato público `21.12.0`, porque vários testes/auditorias e contratos de release do projeto exigem essa versão base. A evolução desta etapa é versionada no módulo `VALORAE_CHART_SERIES_VERSION` como `21.12.2-chart-series-deep-consumer-normalizer`, evitando quebra no app já integrado.

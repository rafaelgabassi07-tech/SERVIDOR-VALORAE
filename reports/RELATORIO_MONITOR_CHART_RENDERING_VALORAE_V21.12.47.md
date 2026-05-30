# Auditoria Monitor Chart Rendering — VALORAE v21.12.48

## Objetivo
Aprimorar todos os gráficos do Monitor do Proxy para que eles desenhem de forma consistente, mesmo quando a instância ainda não possui tráfego externo suficiente. A versão preserva a camada canônica v21.12.46, as fontes ricas Investidor10/StatusInvest e a compatibilidade com Vercel Free.

## Problema encontrado
Os gráficos do Monitor dependiam quase exclusivamente do feed de eventos reais. Em instâncias novas, frias ou com pouco tráfego, os canvases ficavam visualmente pobres ou pareciam não funcionar. O backend podia estar saudável, mas a ausência de eventos deixava os gráficos sem desenho útil.

## Correções e melhorias aplicadas
- Estado vazio desenhado diretamente no canvas, com mensagem contextual.
- Séries agregadas/fallback quando ainda não há eventos reais.
- Gráfico de fluxo agora pode usar eventos, buckets de tempo ou snapshot agregado.
- Gráficos de latência e payload agora têm fallback por métricas agregadas.
- Status HTTP usa eventos ou distribuição agregada do endpoint `/api/server/metrics`.
- Novos gráficos do ecossistema VALORAE:
  - perfil de extração;
  - cache e fontes;
  - dados ricos entregues;
  - completude da extração;
  - confiabilidade por bloco;
  - benchmark visual;
  - saúde dos endpoints.
- `derive()` agora preserva o snapshot completo de métricas para gráficos derivados.
- `public/index.html` e `public/server.html` continuam espelhados.
- Criado teste regressivo `test/monitor-chart-rendering-v21-12-48.test.js`.

## Canvases validados
- `flowChart`
- `latencyChart`
- `bytesChart`
- `statusChart`
- `profileChart`
- `cacheSourceChart`
- `richDataChart`
- `completenessChart`
- `reliabilityChart`
- `benchmarkChart`
- `healthChart`

## Resultado
O Monitor deixa de parecer quebrado quando o feed está vazio e passa a explicar visualmente o estado operacional do Proxy. Quando chegam dados reais, os gráficos são atualizados com eventos, payloads, status, perfis, cache, fontes e dados de completude.

## Validações executadas
- `npm run check` — 265 arquivos JS.
- `npm test`.
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
- `npm audit --omit=dev`: 0 vulnerabilidades.

## Benchmarks observados

| Benchmark | Média | P95 | Observação |
|---|---:|---:|---|
| fast-selectors-single-pass | 1.442 ms | 2.083 ms | Extração rápida local/mocada |
| custom-selectors-css-lite | 2.323 ms | 3.045 ms | CSS lite local/mocado |
| turbo sem cache final | 21.401 ms | 27.436 ms | OK, partial=false, score 86 |
| turbo cache hit | 0.746 ms | 0.821 ms | OK, partial=false, hit rate 96.15% |
| stale low latency | 1.963 ms | 12.703 ms | OK, partial=false |
| canonical cold | 15.996 ms | 76.870 ms | OK, partial=false |
| canonical cache | 0.993 ms | 1.393 ms | OK, partial=false |

## Veredito
A versão `21.12.48-monitor-responsive-settings-theme` está aprovada para uso pessoal. Ela não altera a estratégia de extração, não remove dados ricos e melhora diretamente a experiência visual do Monitor.

# Auditoria Global — Checkpoints 27 a 33 — Análise

Data: 2026-06-16  
Proxy patch: `21.12.116-analysis-checkpoints-27-33-review`  
Contrato: `AnalysisPageResponse`  
Endpoint: `/api/v1/analysis`  
`contractVersion`: `26.analysis.v2`

## Escopo revisado

- Checkpoint 27 — Auditoria do contrato único.
- Checkpoint 28 — Gráficos reais.
- Checkpoint 29 — Histórico de Indicadores.
- Checkpoint 30 — DRE, Balanço e Fluxo de Caixa.
- Checkpoint 31 — Sobre Empresa/Fundo.
- Checkpoint 32 — Negócios e Regiões de Receita.
- Checkpoint 33 — Comparadores.

## Correções feitas nesta revisão

1. **Testes standalone do Proxy**

   Alguns testes do Proxy validavam arquivos do APK usando caminho relativo `../apk/...`. Isso funcionava no ambiente de trabalho quando APK e Proxy estavam lado a lado, mas falhava quando o Proxy era extraído sozinho. Os testes agora validam o APK quando a pasta irmã existe, mas não quebram o pacote Proxy standalone.

2. **Séries multi_line alinhadas**

   `dualSeriesChart` agora exige pelo menos dois períodos em comum entre as duas séries antes de montar gráficos como Receitas e Lucros ou Lucro x Cotação. Isso evita gráfico parcialmente montado com apenas uma linha real ou períodos desalinhados.

3. **Política de fontes explícita**

   O `sourcePolicy` do contrato foi atualizado para declarar o papel de StatusInvest/Investidor10, Yahoo Finance, B3 e BCB por tipo de dado, sem simular ausências.

4. **Changelog e metadados**

   APK e Proxy foram alinhados para indicar que a base mais recente é a revisão global dos Checkpoints 27 a 33.

## Resultado

- A página Análise continua lendo somente `/api/v1/analysis`.
- Contratos antigos permanecem preservados para outros modais.
- Séries temporais seguem em linha/multi_line.
- Composições percentuais seguem em barras horizontais ou donut conforme o contexto.
- Comparadores continuam bloqueando ticker próprio, proxy ticker, ETF substituto, série simulada e flags falsas aninhadas.

## Limite conhecido

O Gradle do APK não foi executado porque o pacote não possui wrapper completo/jar executável e o ambiente não possui `gradle`. A validação do APK foi estática, enquanto a validação executável foi feita no Proxy.

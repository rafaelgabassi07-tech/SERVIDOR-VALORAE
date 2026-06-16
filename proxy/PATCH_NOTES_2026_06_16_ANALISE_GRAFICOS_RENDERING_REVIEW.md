# Patch 21.12.112 — Revisão dos gráficos da Análise

- Corrige a montagem visual dos gráficos da página Análise para que séries temporais não apareçam como barras.
- Mantém o contrato único `/api/v1/analysis` e o contrato `AnalysisPageResponse`.
- O Proxy classifica séries temporais como `line`/`multi_line` e distribuições como `donut_composition`.
- O APK desenha séries temporais em Canvas como linhas nativas e distribuições em composição/donut.
- Nenhum dado ausente, índice ou gráfico é simulado.

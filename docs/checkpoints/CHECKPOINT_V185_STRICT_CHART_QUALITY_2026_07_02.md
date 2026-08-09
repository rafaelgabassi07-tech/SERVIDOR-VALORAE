# v185 — Qualidade estrita de gráficos e captura contínua

Proxy v185 continua a auditoria de captura, bloqueia gráfico de cotação com ponto único, adiciona sourceCaptureMap/criticalMissingSectionIds ao dataQuality e reforça a política de gráficos reais para APK e modais.

## Escopo
- AnalysisPageResponse
- Gráficos da Análise e dos modais
- Auditoria de sourceCoverage/dataQuality

## Regras novas
- Gráfico temporal precisa ter série suficiente para exibição.
- Cotação com apenas um ponto não deve virar gráfico profissional.
- Seção crítica ausente fica explícita no `dataQuality.criticalMissingSectionIds`.

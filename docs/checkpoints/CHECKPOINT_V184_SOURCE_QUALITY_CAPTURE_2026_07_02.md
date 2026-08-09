# Checkpoint v184 — Auditoria de captura, cobertura e qualidade das fontes

Proxy v184 amplia o comparador do Investidor10 para Setor, Subsetor e Segmento, adiciona sourceCoverage/dataQuality no topo do AnalysisPageResponse e reforça a auditoria de gráficos reais enviados ao APK.

## Contrato
- `sourceCoverage`: lista de seções esperadas/implementadas por tipo de ativo.
- `dataQuality`: resumo de cobertura, total de itens/gráficos, gráficos exatos/derivados/desconhecidos e reconstruções bloqueadas.

## Investidor10
- Comparador fundamentalista preserva Ativo, pares relacionados, Setor, Subsetor e Segmento quando a fonte entrega os valores.

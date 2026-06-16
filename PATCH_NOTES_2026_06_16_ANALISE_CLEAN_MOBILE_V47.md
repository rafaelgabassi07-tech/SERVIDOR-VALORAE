# 2026-06-16 — Análise clean mobile v47

Release: `21.12.131-analysis-clean-mobile-v47`

## Objetivo
Continuar a limpeza visual da página Análise no APK sem alterar o contrato nem criar dados.

## Ajustes
- Categorias passam a ser blocos planos com divisórias discretas, reduzindo cards/containers pesados.
- Listas genéricas passam a agrupar por categoria/fonte quando isso melhora a leitura.
- Gráficos deixam de exibir quatro mini-cards de leitura abaixo de cada gráfico; a leitura vira linha compacta.
- Gráfico de comparação com índices passa a usar cor estável por índice no APK, independente da ordem das séries.

## Dados
- Sem mock, sem fallback sintético, sem valores estimados como reais.
- O Proxy mantém o contrato `/api/v1/analysis` e somente atualiza metadados/documentação deste checkpoint.

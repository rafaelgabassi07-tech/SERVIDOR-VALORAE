# Patch notes — Análise clean mobile v46

Release: `21.12.130-analysis-clean-mobile-v46`
Data: 2026-06-16

## Objetivo
Organizar a página de Análise para leitura mobile mais limpa, com categorias claras, menos containers visuais, listas mais leves e gráfico de comparação com índices preservando todos os índices reais recebidos.

## Ajustes técnicos
- O contrato de comparação agora preserva no gráfico combinado `asset_vs_indices` o ativo + IBOV, IFIX, CDI, IPCA, SMLL e IDIV quando todos chegam com séries reais alinhadas.
- O limite interno do comparador combinado subiu de 5 para 7 séries, evitando ocultar índices válidos.
- A saída de comparadores mantém mais itens reais no resumo para o APK exibir todos os índices aplicáveis.
- Criado teste regressivo `test/analysis-clean-mobile-v46.test.js` cobrindo ativo + seis índices no mesmo gráfico.

## Regra de dados
Nenhum índice é criado, estimado ou simulado. O gráfico só preserva séries reais já recebidas e alinhadas pelo Proxy.

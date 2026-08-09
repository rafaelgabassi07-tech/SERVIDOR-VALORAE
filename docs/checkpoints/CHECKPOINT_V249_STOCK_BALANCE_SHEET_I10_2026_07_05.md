# Checkpoint v249 — Balanço Patrimonial de ações via Investidor10

Proxy: `21.12.278-stock-balance-sheet-i10-v249`  
Contrato de ação: `26.asset-modal.stock.v30`  
APK pareado: `apk_valorae_stock_balance_sheet_i10_v368_AI_STUDIO_ROOT_OK_2026_07_05.zip`

## Problema corrigido

O modal de ação recebia somente `Patrimônio Líquido Consolidado - (R$)` no bloco de Balanço Patrimonial. A origem anterior priorizava payloads de evolução patrimonial/gráficos e não a tabela de Ativos e Passivos publicada pelo Investidor10.

## Implementação

- Adicionadas tentativas para endpoints de tabela do Investidor10: `ativospassivos/table`, `balancopatrimonial/table` e `patrimonial/table`.
- Normalizador aceita payloads com `columns/data`, `headers/rows`, arrays de arrays e objetos por linha.
- Colunas auxiliares `AV %` e `AH %` são descartadas para não poluir os períodos.
- Linhas normalizadas: Ativo Total, Ativo Circulante, Ativo Não Circulante, Passivo Total, Passivo Circulante, Passivo Não Circulante e Patrimônio Líquido Consolidado.

## Integridade

Sem fallback fixo de PETR4/GGRC11, sem mock e sem simulação. Quando a fonte real não entregar a tabela, o bloco permanece vazio/indisponível.

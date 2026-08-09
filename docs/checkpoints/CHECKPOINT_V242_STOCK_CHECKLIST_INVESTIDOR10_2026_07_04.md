# Checkpoint v242 — Checklist Buy and Hold de ações via Investidor10

## Objetivo
Corrigir o modal único de ação para receber do Proxy todos os critérios públicos do checklist Buy and Hold do Investidor10, sem dados simulados e sem fallback de outro ativo.

## Correção aplicada
- O parser `extractInvestidor10StockBuyHoldChecklist` não usa mais `DIVIDENDOS` genérico como fim de seção.
- O corte agora considera somente títulos reais de próxima seção, como `Histórico de Dividendos`, comparador, receitas/lucros, comunicados, resultados ou copyright.
- O contrato de ação foi atualizado para `26.asset-modal.stock.v23`.
- O status de cada critério não é derivado por fundamentos locais; quando a marcação visual do Investidor10 não estiver disponível, o item fica `UNKNOWN`.

## Critérios esperados para PETR4 quando a fonte retornar a seção completa
1. Empresa com mais de 5 anos de Bolsa
2. Empresa nunca deu prejuízo (ano fiscal)
3. Empresa com lucro nos últimos 20 trimestres (5 anos)
4. Empresa pagou +5% de dividendos/ano nos últimos 5 anos
5. Empresa possui ROE acima de 10%
6. Empresa possui dívida menor que patrimônio
7. Empresa apresentou crescimento de receita nos últimos 5 anos
8. Empresa apresentou crescimento de lucros nos últimos 5 anos
9. Empresa possui liquidez diária acima de US$ 2M
10. Empresa é bem avaliada pelos usuários do Investidor10

## Política de dados
Sem fallback estático, sem mock e sem reaproveitamento de PETR4/GGRC11. Se a fonte real não fornecer a seção ou a marcação, o retorno será `EMPTY`/`UNKNOWN`.

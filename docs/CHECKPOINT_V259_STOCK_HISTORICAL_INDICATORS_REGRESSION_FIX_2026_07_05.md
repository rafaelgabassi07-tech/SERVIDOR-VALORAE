# Checkpoint v259 — Correção da regressão do Histórico de Indicadores Fundamentalistas

## Objetivo
Corrigir a regressão observada após o ajuste visual do Histórico de Indicadores Fundamentalistas, preservando dados reais do Investidor10 e mantendo descriptions/metadados fora da grade.

## Alterações principais
- Contrato de ação atualizado para `26.asset-modal.stock.v40`.
- Release patch atualizado para `21.12.288-stock-historical-indicators-regression-fix-v259`.
- Regressão adicionada para payloads com colunas temporais em formato `current` e datas completas como `2025-12-31`.
- Garantia de remoção de `description` da grade sem descartar valores históricos válidos.

## Política de dados
- Sem fallback PETR4/GGRC11.
- Sem WebView.
- Sem mock ou dado simulado.
- Se a fonte real não retornar dados normalizáveis, o contrato mantém estado vazio.

## Validação
- `node --check lib/analysis/stock-modal-contract.js`
- `node test/stock-modal-historical-indicators-rest-i10-v256.test.js`
- `npm test` — 124 arquivos, 0 falhas
- `npm run audit:version`

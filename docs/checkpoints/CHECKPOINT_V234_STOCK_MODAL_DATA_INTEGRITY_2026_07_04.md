# Checkpoint v234 — Stock Modal Data Integrity

Data: 2026-07-04

Contrato de ação: `26.asset-modal.stock.v17`

## Objetivo

Corrigir integridade e escopo dos dados do modal de ação sem alterar visual, ordem de seções, endpoints ou nomes de campos consumidos pelo APK.

## Ajustes

- Cotação do cabeçalho e fatos do perfil resolvidos pelo ticker visualizado, priorizando Yahoo Finance Chart API.
- Guard de identidade da página Investidor10 para evitar reaproveitamento indevido de PETR4/Petrobras em outro ativo.
- Variação 12M com fallback Yahoo 1Y.
- Radar de Dividendos Inteligente com contagem, anos observados e score mensal.
- Comparador de ações com fallback setorial restrito ao mesmo grupo/segmento via catálogo interno quando Investidor10 não entrega tabela.
- Parsers adicionais para receitas por região/negócio e posição acionária em JSON/HTML.

## Validações

- `node --check lib/analysis/stock-modal-contract.js`
- `npm run check:syntax`
- `npm test`

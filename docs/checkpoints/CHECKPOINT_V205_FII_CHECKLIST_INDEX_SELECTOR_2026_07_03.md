# Checkpoint v205 — Checklist limpo e índices completos no modal de FIIs

Data: 2026-07-03
Release: 21.12.235-fii-checklist-index-selector-v205
Contrato FII: 26.asset-modal.fii.v13

## Implementado

- Reforço da comparação com índices do modal único de FIIs.
- IFIX, SMLL e IDIV continuam usando Yahoo Finance Chart API como fonte, priorizando os símbolos .SA informados.
- Quando o .SA não entrega pontos suficientes, o Proxy tenta símbolo Yahoo direto alternativo com ^, ainda sem Investidor10, B3, ETF ou proxy ticker para esses índices.
- Planos de busca passam a testar granularidades 1mo, 1wk e 1d dentro da mesma janela 2Y/5Y/10Y.
- CDI e IPCA continuam usando Banco Central SGS.
- Items da simulação de R$ 1.000,00 são gerados para todas as séries históricas válidas e selecionáveis.

## Validação

- node --check lib/analysis/fii-modal-contract.js
- npm run check:syntax
- node test/fii-modal-index-selectors-v205.test.js
- npm test
- npm run audit:version

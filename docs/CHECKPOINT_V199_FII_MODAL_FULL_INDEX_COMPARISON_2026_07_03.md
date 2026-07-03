# Checkpoint v199 — Comparação completa com índices no modal de FIIs

Data: 2026-07-03  
Proxy public version: 21.12.229  
Release patch: 21.12.229-fii-modal-full-index-comparison-v199

## Objetivo
Corrigir o bloco **Comparação com índices** do modal único de FIIs para seguir a mesma família de benchmarks do gráfico de Retorno e desenhar as linhas no gráfico.

## Implementado
- Contrato `/api/v1/asset/fii-modal` evoluído para `26.asset-modal.fii.v7`.
- Comparação por período 2A, 5A e 10A com: ativo, IFIX, CDI, IPCA, IBOV, SMLL, IDIV e IVVB11.
- `seriesByPeriod` e `itemsByPeriod` preenchidos com séries e cards de simulação para cada benchmark disponível.
- IFIX, IDIV e SMLL continuam usando exclusivamente Yahoo Finance Chart API com símbolos diretos `IFIX.SA`, `IDIV.SA` e `SMLL.SA`.
- CDI e IPCA passam a entrar no contrato por séries oficiais Banco Central SGS.
- IBOV usa símbolo direto Yahoo `^BVSP`; IVVB11 usa `IVVB11.SA`.

## Validação
- `node --check lib/analysis/fii-modal-contract.js`
- `node test/fii-modal-yahoo-comparison-v196.test.js`
- `node test/fii-modal-peer-comparison-v198.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

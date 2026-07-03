# Checkpoint v197 — FII modal index comparison visibility

Release date: 2026-07-03
Proxy public version: 21.12.227
Release patch: 21.12.227-fii-modal-index-visibility-v197
Contract: 26.asset-modal.fii.v5

## Objetivo

Corrigir o caso em que a seção **Comparação com índices** não aparecia no modal único quando o ativo era FII e o Yahoo retornava histórico incompleto/parcial para algum período.

## Implementado

- `comparison` permanece presente no contrato do FII, mesmo quando só há cotações rápidas ou diagnóstico parcial.
- IFIX, IDIV e SMLL usam símbolos diretos Yahoo: `IFIX.SA`, `IDIV.SA`, `SMLL.SA`.
- Histórico tenta plano primário e alternativas do próprio Yahoo para 2A/5A/10A.
- Diagnósticos por período/código foram adicionados ao bloco de comparação.

## Validação

- `node --check lib/analysis/fii-modal-contract.js`
- `node test/fii-modal-yahoo-comparison-v196.test.js`
- `node test/fii-modal-contract-v192.test.js`
- `npm run check:syntax`
- `npm run audit:version`

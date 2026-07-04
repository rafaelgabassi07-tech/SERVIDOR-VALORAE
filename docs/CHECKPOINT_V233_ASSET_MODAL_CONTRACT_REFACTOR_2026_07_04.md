# Proxy v233 — Asset Modal Contract Refactor

Data: 2026-07-04
Patch: 21.12.263-asset-modal-contract-refactor-v233

## Objetivo

Acompanhar o APK v352 confirmando que os contratos do Proxy para modal de FII e modal de ação continuam separados.

## Estrutura preservada

- FII: `lib/analysis/fii-modal-contract.js` + `/api/v1/asset/fii-modal`.
- Ação: `lib/analysis/stock-modal-contract.js` + `/api/v1/asset/stock-modal`.

## Garantias

- Sem mudança de endpoint.
- Sem mudança no formato JSON.
- Sem alteração de scraping.
- Pacote pareado apenas para versionamento, documentação e compatibilidade com o APK v352.

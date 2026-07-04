# Checkpoint v236 — Limpeza profunda de resquícios e código abandonado

Patch: `21.12.266-deep-cleanup-unused-residue-v236`

## Limpeza aplicada

- Removido o bloco `modal-reset` do roteador principal.
- Removida a etapa `attachAssetAnalysisPage` do motor principal.
- Removida a função antiga que injetava `assetAnalysisPage` em `payload`, `results`, `appPayload` e `appMobileSnapshot`.
- Atualizados metadados, README, manifest e service worker para o checkpoint v236.

## Preservado

- `/api/v1/asset/fii-modal`
- `/api/v1/asset/stock-modal`
- `/api/v1/assets` em modo sugestão da Análise
- `/api/v1/analysis` como endpoint da página Análise

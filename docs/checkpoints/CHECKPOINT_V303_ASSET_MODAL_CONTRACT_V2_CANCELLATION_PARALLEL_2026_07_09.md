# Proxy checkpoint v303 — Asset modal delivery contract v2

## Runtime
- `fast` e `full` mantêm cache/coalescing separados por estágio.
- Uma chamada `fast` pode reutilizar um `full` fresco equivalente.
- A chave não usa `range`/`interval`, pois esses parâmetros são internos ao estágio.
- Deadline do `fast`: 1,8–4,5 s. Deadline do `full`: 7–12,5 s.

## Contrato
- `delivery.schemaVersion = 2`.
- `requestedStage`, `deliveredStage`, `isFinal`, `completenessPercent`.
- `availableSections`, `deferredSections`, `unavailableSections`, `retryable`, `cacheStatus`.
- Alteração aditiva: campos legados permanecem.

## Validação
- `npm test`: 175 arquivos, 0 falhas antes do empacotamento final.
- Teste dedicado `asset-modal-delivery-cancellation-v303.test.js`.
- Pareado com `apk_valorae_checkpoint57_asset_modal_contract_v2_cancellation_parallel_v467_AI_STUDIO_ROOT_OK_2026_07_09.zip`.

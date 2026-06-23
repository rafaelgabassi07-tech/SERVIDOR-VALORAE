# v104 — Asset modal fast + Agenda Data COM

- Adiciona modo `modal_fast` para `/api/v1/analysis` quando o consumidor é um modal.
- Reduz timeouts de cotação, fundamentos, Yahoo e proventos para evitar demora excessiva na montagem dos modais.
- Usa range `6M` por padrão em modal rápido.
- Pula comparadores/índices pesados no `buildAssetDetails` quando `modal_fast` está ativo.
- Mantém contrato único `AnalysisPageResponse`; apenas reduz custo de montagem do payload para superfícies compactas.

Patch: `21.12.154-asset-modal-fast-agenda-datacom-v104`.

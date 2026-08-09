# Checkpoint v210 — Comparação com índices alinhada ao Retorno

- `/api/v1/asset/fii-modal` evolui para `26.asset-modal.fii.v18`.
- IFIX, SMLL, IDIV e IBOV passam a usar `getAssetHistory`, a mesma camada da página Retorno.
- Yahoo direto (`IFIX.SA`, `SMLL.SA`, `IDIV.SA`) continua prioritário; quando entrega só snapshot, a camada Retorno usa requisições por faixas compatíveis para séries históricas.
- `selectorOptions` fixa os seletores de IFIX, CDI, IPCA, IBOV, SMLL, IDIV e IVVB11 para o APK.
- Teste: `test/fii-modal-return-index-reuse-v210.test.js`.

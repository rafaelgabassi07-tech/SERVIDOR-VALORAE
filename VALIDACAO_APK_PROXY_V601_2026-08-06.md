# Validação APK v601 ↔ Proxy 21.12.404

## Contratos congelados

- `/api/sync` e `/api/v1/mobile/alerts`.
- Protocolo `2026.07.10.10`.
- Contrato `valorae-financial-sync-v2`.
- Schema, campos, `clientTxId`, tombstones, idempotência e conflitos `409`.

## Critérios

1. Build Vercel-safe e sintaxe JavaScript.
2. Importação sob demanda sem `fetch`, `interval` ou `timeout` na carga.
3. Alcance do runtime e SQL mínimo.
4. Suíte geral do Proxy.
5. Contratos cross-stack contra a árvore/ZIP real do APK v601.
6. Consistência da janela de compatibilidade.

Os resultados executados e as limitações ambientais são registrados no relatório externo da entrega v601.

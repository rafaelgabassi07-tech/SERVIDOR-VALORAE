# Validação APK–Proxy v605 — 2026-08-06

## Alvos

- APK: `2026.08.06.19` — checkpoint `v605-refactor-cp7-large-ui`;
- Proxy: `21.12.404`.

## Resultado

- build Vercel-safe: aprovado;
- sintaxe: 427 arquivos JavaScript;
- importação sob demanda: `fetch=0`, `interval=0`, `timeout=0`;
- runtime: 152/152 módulos alcançáveis;
- SQL mínimo: aprovado;
- consistência de versões: aprovada;
- suíte geral: 172 aprovados, 100 bloqueados, 0 falhas;
- contratos cross-stack: 26 aprovados, 17 bloqueados, 0 falhas.

Os bloqueios decorrem exclusivamente da ausência de `cheerio` e `undici` no ambiente de auditoria.

## Contratos congelados

- `/api/sync`;
- `/api/v1/mobile/alerts`;
- `valorae-financial-sync-v2`;
- protocolo `2026.07.10.10`;
- Room schema 13 no APK;
- outbox, `clientTxId`, tombstones, idempotência, retries e conflitos `409`.

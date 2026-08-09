# Validação APK–Proxy v606 — 2026-08-06

Pareamento do APK `2026.08.06.20` com o Proxy `21.12.404`.

## Resultado

- build Vercel-safe: aprovado;
- sintaxe: 427 arquivos JavaScript;
- importação sob demanda: `fetch=0`, `interval=0`, `timeout=0`;
- runtime: 152/152 módulos alcançáveis;
- SQL mínimo: aprovado;
- consistência de versões: aprovada;
- suíte geral: 172 aprovados, 100 bloqueados, 0 falhas;
- cross-stack: 26 aprovados, 17 bloqueados, 0 falhas.

Bloqueios: `cheerio` (99 gerais/16 cruzados) e `undici` (1 geral/1 cruzado).

O pareamento mantém `/api/sync`, `/api/v1/mobile/alerts`, protocolo `2026.07.10.10`, `valorae-financial-sync-v2`, SQL, payloads, idempotência, outbox e conflitos sem alteração. A primeira versão futura fora da janela homologada é `2026.08.06.21`.

# Validação APK–Proxy v607 — 2026-08-06

Pareamento do APK `2026.08.06.21` com o Proxy `21.12.404`.

## Resultado

- Build Vercel-safe: aprovado.
- Sintaxe: 427 arquivos JavaScript aprovados.
- Auditoria on-demand: `fetch=0`, `interval=0`, `timeout=0`.
- Runtime alcançável: 152/152 módulos.
- SQL mínimo: aprovado.
- Consistência de versões: aprovada.
- Suíte geral executável: 172 aprovados, 100 bloqueados por dependências ausentes, 0 falhas.
- Cross-stack executável: 26 aprovados, 17 bloqueados por dependências ausentes, 0 falhas.

Bloqueios: `cheerio` (99 gerais + 16 cruzados) e `undici` (1 geral + 1 cruzado). Testes bloqueados não são contabilizados como aprovados.

O pareamento mantém `/api/sync`, `/api/v1/mobile/alerts`, protocolo `2026.07.10.10`, `valorae-financial-sync-v2`, SQL, payloads, idempotência, outbox e conflitos sem alteração. A primeira versão futura fora da janela homologada é `2026.08.06.23`.

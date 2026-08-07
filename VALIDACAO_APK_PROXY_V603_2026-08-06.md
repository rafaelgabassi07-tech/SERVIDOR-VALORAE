# Validação APK v603 ↔ Proxy 21.12.404

## Par homologado

- APK: `2026.08.06.17` — checkpoint `v603-refactor-cp6-portfolio`;
- Proxy: `21.12.404`;
- protocolo móvel: `2026.07.10.10`;
- contrato financeiro: `valorae-financial-sync-v2`;
- ecossistema: `valorae-ecosystem-2026.08.05.04-p404`.

## Escopo de compatibilidade

A homologação confirma que a reorganização física da Carteira não altera `/api/sync`, `/api/v1/mobile/alerts`, payloads financeiros, SQL, autenticação, `clientTxId`, tombstones, claims, idempotência, conflitos `409` ou retries. Os guardrails que leem fontes do APK passaram a apontar para `com.example.app.portfolio` e `com.example.feature.portfolio`.

## Gates executados

- build Vercel-safe: aprovado;
- sintaxe: 427 arquivos JavaScript;
- importação sob demanda: `fetch=0`, `interval=0`, `timeout=0`;
- alcance do runtime: 152/152 módulos;
- SQL mínimo: aprovado;
- consistência de versões: aprovada;
- suíte geral: 172 aprovados, 100 bloqueados, 0 falhas;
- contratos cross-stack: 26 aprovados, 17 bloqueados, 0 falhas.

Os bloqueios decorrem exclusivamente de dependências ausentes no ambiente: `cheerio` (99 testes gerais e 16 cruzados) e `undici` (1 teste geral e 1 cruzado). Nenhum teste bloqueado foi contabilizado como aprovado.

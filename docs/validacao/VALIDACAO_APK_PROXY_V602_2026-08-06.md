# Validação APK v602 ↔ Proxy 21.12.404

## Par homologado

- APK: `2026.08.06.16` — checkpoint `v602-refactor-cp6-settings`;
- Proxy: `21.12.404`;
- protocolo móvel: `2026.07.10.10`;
- contrato financeiro: `valorae-financial-sync-v2`;
- ecossistema: `valorae-ecosystem-2026.08.05.04-p404`.

## Gates executados

- build Vercel-safe: aprovado;
- sintaxe: 427 arquivos JavaScript;
- importação sob demanda: `fetch=0`, `interval=0`, `timeout=0`;
- alcance do runtime: 152/152 módulos;
- SQL mínimo: aprovado;
- consistência de versões: aprovada;
- suíte geral: 172 aprovados, 100 bloqueados, 0 falhas;
- contratos cross-stack: 26 aprovados, 17 bloqueados, 0 falhas.

Os bloqueios são exclusivamente dependências ausentes no ambiente: `cheerio` (99 testes gerais e 16 cruzados) e `undici` (1 teste geral e 1 cruzado). Nenhum teste bloqueado foi contado como aprovado.

Nenhuma rota, payload, tabela, protocolo, política de sincronização, tombstone, claim, retry ou semântica de conflito foi alterada neste checkpoint.

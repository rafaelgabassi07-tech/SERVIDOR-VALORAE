# Checkpoint 355 — Asset modal content cleanup v323

## Objetivo

Alinhar o Proxy ao APK v503 removendo integralmente a posição acionária do fluxo operacional dos modais de Ação.

## Mudanças

- removidas chamadas dedicadas a `posicao-acionaria`, `acionistas` e `shareholders`;
- `shareholdingPosition` removido das seções recuperáveis;
- removido do payload principal, readiness, completude, cache e quality profile;
- recovery legado exclusivo da seção desativada não dispara coleta profunda genérica;
- parsers históricos permanecem isolados apenas para compatibilidade e testes, sem uso no produtor.

## Pareamento

- APK: v503 / Checkpoint 93;
- Proxy: 21.12.355 / v323;
- protocolo móvel: 2026.07.10.10.

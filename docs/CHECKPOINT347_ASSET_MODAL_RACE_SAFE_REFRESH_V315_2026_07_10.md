# Checkpoint 347 — Asset modal race-safe refresh v315

Pareamento: APK v478 / protocolo móvel `2026.07.10.8`.

## Inconsistências corrigidas

- Recovery e requisição normal compartilhavam a mesma coalescência externa e podiam receber a mesma resposta antiga.
- Refresh forçado ignorava a leitura e também não promovia o resultado ao cache.
- Um producer tardio de menor qualidade podia substituir um snapshot completo.
- Cache stale mais rico só aparecia após aguardar nova coleta, apesar de já representar avanço visível.

## Implementação

- `modalRuntimeCoalesceKey` separa normal, recovery e refresh por requestId.
- `modalProducerFlights` continua deduplicando somente o trabalho pesado.
- `promoteModalCache` compara finalização, estabilidade, seções profundas e completude.
- Qualidade inferior não substitui cache mais rico; qualidade equivalente pode renovar cotação, nome e logo.
- `RECOVERY_STALE_UPGRADE` responde imediatamente e dispara revalidação em segundo plano.
- Refresh forçado grava respostas úteis no cache.

## Testes

`asset-modal-race-safe-refresh-v315.test.js` cobre separação de chaves, refresh com cache, stale upgrade, producer em segundo plano e proteção contra downgrade.

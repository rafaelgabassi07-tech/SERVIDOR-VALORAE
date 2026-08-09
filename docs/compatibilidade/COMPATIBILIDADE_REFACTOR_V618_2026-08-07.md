# Compatibilidade de refatoração — APK v618 / Proxy 21.12.404

- APK pareado: `2026.08.07.09` (`v618-refactor-cp17-domain-model-boundary`).
- Proxy público: `21.12.404`.
- Mínimo suportado: `2026.07.30.01`.
- Máximo homologado: `2026.08.07.09`.
- Primeira versão futura não homologada: `2026.08.07.10`.
- Protocolo móvel preservado: `2026.07.10.10`.
- Contrato financeiro preservado: `valorae-financial-sync-v2`.

O CP17 altera apenas a fronteira interna de modelos no APK. Não altera rotas, nomes/tipos de payload, Room, outbox, `clientTxId`, idempotência ou protocolo.

As árvores `api/` e `routes/` permanecem byte-equivalentes à entrega v617. Em `lib/`, somente `lib/core/apk-compatibility.js` muda para avançar `pairedVersion` e `maxTestedVersion`.

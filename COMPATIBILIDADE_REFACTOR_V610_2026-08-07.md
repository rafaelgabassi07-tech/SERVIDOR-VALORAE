# Compatibilidade da refatoração v610

Proxy público 21.12.404 pareado ao APK `2026.08.07.01` (v610 / CP8).

A homologação amplia somente a janela de versão do APK. Permanecem congelados `/api/sync`, `/api/v1/mobile/alerts`, protocolo móvel `2026.07.10.10`, `valorae-financial-sync-v2`, payloads, SQL, idempotência, outbox, tombstones, retries e conflitos 409.

Janela:
- mínimo suportado: `2026.07.30.01`;
- pareado: `2026.08.07.01`;
- máximo homologado: `2026.08.07.01`;
- `2026.08.07.02` é tratado como APK futuro não homologado em produção.

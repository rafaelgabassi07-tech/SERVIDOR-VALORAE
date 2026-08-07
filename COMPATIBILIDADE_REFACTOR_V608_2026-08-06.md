# Compatibilidade da refatoração v608

Proxy público 21.12.404 pareado ao APK `2026.08.06.23` (v608 / CP7.4).

A alteração do APK é estrutural e limitada à decomposição de Ajuda/Sobre/Diagnóstico de Configurações. Não há mudança em endpoints, protocolo móvel, payload financeiro, SQL, outbox, tombstones ou política de conflitos.

Janela:
- mínimo suportado: `2026.07.30.01`;
- pareado: `2026.08.06.23`;
- máximo homologado: `2026.08.06.23`;
- `2026.08.06.24` é tratado como APK futuro não homologado em produção.

# Compatibilidade de refatoração — APK v613 / Proxy 21.12.404

O Proxy 21.12.404 permanece compatível com o APK `2026.08.07.04` / checkpoint `v613-refactor-cp12-ui-effects-isolation`.

O CP12 é exclusivamente uma refatoração interna do APK: transporte/cache/persistência foram deslocados das Composables de Alertas e Notícias para ViewModels. Não houve alteração de rota, método HTTP, payload, protocolo móvel, Room ou semântica de sincronização.

Janela versionada:

- mínimo suportado: `2026.07.30.01`;
- pareado/máximo homologado por contrato: `2026.08.07.04`;
- primeira versão futura não homologada: `2026.08.07.05`.

As árvores `api/` e `routes/` permanecem byte-equivalentes ao pacote pareado à v612.

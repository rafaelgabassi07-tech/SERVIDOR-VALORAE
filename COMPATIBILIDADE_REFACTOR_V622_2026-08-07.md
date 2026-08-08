# Compatibilidade APK v622 / Proxy 21.12.404

- APK pareado: `2026.08.07.13` / `26080713`.
- Proxy público: `21.12.404`.
- Protocolo móvel: `2026.07.10.10`.
- `/api/v1/mobile/alerts`: inalterado.
- `/api/sync`: inalterado.
- `/api/v1/mobile/daily-close`: inalterado.
- Payloads e SQL financeiro: inalterados.
- Primeira versão futura não homologada: `2026.08.07.14`.

A v622 corrige apenas confiabilidade local de notificações e fallback stale no APK. `api/` e `routes/` do Proxy permanecem byte-equivalentes à entrega v621; em `lib/`, somente a janela explícita de compatibilidade foi avançada.

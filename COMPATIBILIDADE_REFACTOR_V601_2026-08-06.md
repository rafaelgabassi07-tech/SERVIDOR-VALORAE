# Compatibilidade da refatoração v601 — CP6.4 Análise

## Pareamento

- APK: `2026.08.06.15` — checkpoint `v601-refactor-cp6-analysis`.
- Proxy: `21.12.404`.
- Protocolo móvel: `2026.07.10.10`.
- Contrato financeiro: `valorae-financial-sync-v2`.
- Ecossistema: `valorae-ecosystem-2026.08.05.04-p404`.

## Escopo

A v601 reorganiza a feature Análise no APK e move o campo de busca compartilhado para `ui.shared`. O Proxy não recebe mudanças funcionais: endpoints, payloads, SQL, autenticação, idempotência, tombstones, conflitos e política de retry permanecem inalterados.

## Janela

- Mínimo aceito: `2026.07.30.01`.
- Pareado e máximo homologado: `2026.08.06.15`.
- Versões acima da janela continuam tratadas pela política `valorae-apk-compatibility-v2-backward-compatible`.

## Rollback

O APK pode voltar à v600 sem alteração no banco ou no Proxy. O Proxy 21.12.404 continua aceitando as versões anteriores dentro da janela definida.

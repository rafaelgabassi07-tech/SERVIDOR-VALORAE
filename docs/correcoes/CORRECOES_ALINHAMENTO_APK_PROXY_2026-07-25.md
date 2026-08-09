# Correções de alinhamento APK/Proxy — 2026-07-25

## Aplicado

- Pareamento do Proxy atualizado para APK v546 (`2026.07.25.09`).
- `package.json`, `metadata.json` e README alinhados ao checkpoint `v546-b3-import-accuracy`.
- Auditoria de versão reforçada para comparar o Proxy com o `metadata.json` e o Gradle do APK quando `VALORAE_APK_ROOT`/`VALORAE_REQUIRE_APK` forem usados.
- Testes cross-stack deixaram de aceitar apenas versões antigas fixadas no código.
- Teste dedicado valida metadados, header de autenticação e integração com o APK.
- Documentação de `VALORAE_CLIENT_KEYS` e `VALORAE_REQUIRE_CLIENT_AUTH` adicionada.

## Validação

- Build Vercel aprovado.
- 506 arquivos JavaScript aprovados na verificação sintática.
- Auditoria de versão integrada aprovada.
- Suíte do Proxy: 164 aprovados, 107 bloqueados por dependências ausentes, 0 falhas.
- Cross-stack: 22 aprovados, 17 bloqueados por dependências ausentes, 0 falhas.

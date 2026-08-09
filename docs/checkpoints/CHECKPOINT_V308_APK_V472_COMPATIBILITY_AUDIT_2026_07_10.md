# Proxy v308 — Compatibilidade com APK v472

Release pública: `21.12.340`  
Patch: `21.12.340-apk-v472-compatibility-audit-v308`

## Objetivo

Revalidar que os ajustes locais do APK v472 — tema inicial, estado de scroll, filtros, detalhes do histórico e atalho de importação B3 — não introduzem divergência com os contratos HTTP existentes.

## Contratos preservados

- `/api/v1/asset/modal` e rotas legadas de Ação/FII.
- `/api/v1/portfolio/history`.
- `/api/portfolio/transactions`.
- `/api/sync` para transações e snapshots.
- `/api/v1/asset/logo`.
- `/api/v1/news`.

A importação B3 permanece local no APK e utiliza o fluxo de transações já existente; nenhum endpoint paralelo foi criado.

## Validação

- Build Vercel-safe.
- Verificação sintática.
- Suíte completa.
- Auditoria de versão.
- Teste de compatibilidade autônomo com APK v472.

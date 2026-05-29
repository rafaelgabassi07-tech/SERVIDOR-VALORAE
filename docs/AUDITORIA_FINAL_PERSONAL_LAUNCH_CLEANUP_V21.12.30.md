# Auditoria v21.12.30 — Final Personal Launch Cleanup

## Objetivo

Fechar os ajustes necessários para lançamento pessoal controlado do VALORAE Engine e do monitor do proxy, sem adicionar dependências pagas e sem desmembrar `lib/Valorae-engine.js`.

## Correções aplicadas

- Adicionado `.gitignore` para proteger `.env`, `.vercel`, caches, builds e materiais locais.
- `public/index.html` e `public/server.html` agora declaram `/api/ready` e `/api/v1/release/readiness`.
- `/api/asset` usa `view=app` como fallback padrão quando a view não é informada.
- `/api/assets` usa `view=app` como fallback padrão quando a view não é informada.
- `personalReleaseReadiness` foi atualizado para o patch `21.12.30-final-personal-launch-cleanup`.
- `VALORAE_SERVER_METRICS_VERSION` foi atualizado para `21.12.30-final-personal-launch-monitor`.
- PWA/metadata/README/CHANGELOG sincronizados.
- Novo teste de regressão `test/final-personal-launch-cleanup-v21-12-30.test.js`.

## Resultado esperado

- `npm run audit:release` deve passar.
- O lançamento pessoal fica pronto para uso controlado com pessoas próximas.
- O app Web/APK recebe um contrato enxuto por padrão, reduzindo risco de payload pesado e divergências.

## Observação

A telemetria permanece em memória por instância serverless para manter compatibilidade com Vercel Free. Histórico global persistente continua como evolução opcional futura, não obrigatória.

# Auditoria v21.12.26 — Personal Maturity Controlled Release

## Objetivo

Aplicar a auditoria anterior ao cenário real do VALORAE: uso pessoal e pessoas próximas. A meta não é transformar o projeto em API comercial pública com SLA, e sim amadurecer confiabilidade, integração Web/APK, monitoramento e manutenção sem perder a compatibilidade com Vercel gratuito.

## Implementações

- Novo módulo `lib/release/personal-maturity.js`.
- Novo endpoint `/api/v1/release/readiness`.
- Alias `/api/v1/personal/readiness`.
- `/api/server/metrics` agora inclui `personalReleaseReadiness`.
- `/api/v1/source/status` agora inclui `personalReleaseReadiness`.
- Monitor visual ganhou página `Maturidade pessoal`.
- `VALORAE_SERVER_METRICS_VERSION` atualizado para `21.12.26-personal-maturity-monitor`.
- `README.md`, `metadata.json`, `manifest.webmanifest`, `.env.example`, OpenAPI e Fields sincronizados.
- `routes/asset.js` e `routes/assets.js` agora aceitam variáveis opcionais de view padrão: `VALORAE_DEFAULT_ASSET_VIEW` e `VALORAE_DEFAULT_ASSETS_VIEW`.

## Score de maturidade

O novo readiness avalia:

- configuração e deploy gratuito;
- autenticação para pessoas próximas;
- contrato Web/APK com `view=app`;
- observabilidade do monitor;
- fontes e precisão;
- performance do engine;
- documentação/manutenção;
- persistência de telemetria em memória.

## Decisão técnica

O projeto continua free-only. Não foi adicionado banco, Redis, KV, WebSocket, cron pago ou serviço externo obrigatório. A limitação de histórico em memória foi mantida e documentada como aceitável para uso pessoal.

## Como validar

```bash
npm run check
node test/personal-maturity-v21-12-26.test.js
npm test
npm run build
npm run audit:free
npm run audit:version
npm run typecheck
npm run smoke
```

## Resultado esperado

Para uso pessoal e pessoas próximas: **Release Candidate maduro**. Para API comercial pública com SLA e histórico persistente: ainda exigiria persistência opcional, auth obrigatória e monitor distribuído.

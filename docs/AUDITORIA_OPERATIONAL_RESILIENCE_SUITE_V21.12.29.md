# Auditoria v21.12.29 — Operational Resilience Suite

Esta rodada amadurece o ecossistema VALORAE Engine para uso pessoal e pessoas próximas, sem dependências pagas e preservando `lib/Valorae-engine.js` como núcleo central.

## Implementações

- `lib/quality/field-consistency-guard.js`: guardião de consistência financeira por campo.
- `lib/quality/payload-budget.js`: orçamento aproximado de payload por raiz.
- `lib/quality/asset-action-plan.js`: plano de ação para renderização/cache/banner no app.
- `/api/v1/asset/quality`: auditoria de qualidade por ticker.
- `/api/v1/asset/action-plan`: decisão de renderização por ticker.
- `/api/v1/integration/manifest`: manifesto vivo para Web/APK/IA.
- Monitor web com páginas novas para consistência, orçamento, plano de ação e manifesto.

## Ganhos

- Mais precisão: campos suspeitos são sinalizados antes de virar card ou gráfico.
- Mais performance: app ganha orçamento de payload e direção clara para usar `view=app`/`compact`.
- Mais confiabilidade: o app recebe decisão pronta para manter snapshot bom quando fonte/payload vier parcial.
- Mais integração: uma única rota documenta headers, roots estáveis, views e regras anti-tela-vazia.

## Compatibilidade

- Sem Redis, KV, banco, storage externo, cron pago ou WebSocket.
- Vercel Free preservado.
- `VALORAE_ENGINE_VERSION` permanece `21.12.0`.

# Auditoria v21.12.10 — App Response Integrity

## Objetivo

Adicionar uma camada final de validação do payload consumido pelo APK/Web, verificando se os contratos criados nas versões anteriores realmente estão coerentes entre si antes de o app substituir cache local, desenhar gráficos ou limpar snapshots bons.

## Novo módulo

- `lib/quality/app-response-integrity.js`
- Campo final no engine: `appResponseIntegrity`

## O que o módulo valida

- Presença das raízes críticas do consumidor:
  - `appPayload`
  - `appRenderContract`
  - `appDataContract`
  - `appSyncEnvelope`
  - `appMobileSnapshot`
- Integridade de métricas:
  - quantidade de métricas canônicas
  - fallback para `normalized`
  - aliases quebrados apontando para campos ausentes
- Integridade de gráficos:
  - paridade entre `chartSeries` e `appPayload.charts`
  - snapshot mobile como subconjunto compacto
  - overflow de pontos amostrados no mobile
- Integridade de sincronização:
  - presença de decisão e identidade
  - paridade entre `appSyncEnvelope.identity.payloadHash` e `appMobileSnapshot.sync.payloadHash`
  - bloqueio de `replace_snapshot` quando o contrato não permite substituição
- Orçamento de payload:
  - tamanho aproximado do payload completo
  - tamanho de `appPayload`
  - tamanho de `appMobileSnapshot`
  - recomendação de `view` para mobile

## Novos sinais para o app

- `appResponseIntegrity.ok`
- `appResponseIntegrity.score`
- `appResponseIntegrity.renderSafe`
- `appResponseIntegrity.cacheSafe`
- `appResponseIntegrity.sections`
- `appResponseIntegrity.issues`
- `appResponseIntegrity.appInstructions`

## Regras práticas para o APK/Web

1. Usar `appMobileSnapshot` para primeira pintura.
2. Usar `appPayload` para renderização completa.
3. Usar `appSyncEnvelope.identity.payloadHash` para comparar mudanças reais.
4. Só substituir cache local automaticamente quando `appResponseIntegrity.cacheSafe=true`.
5. Manter snapshot anterior quando `appResponseIntegrity.ok=false`, `cacheSafe=false` ou o envelope recomendar `shouldKeepPreviousSnapshot=true`.

## Benefício esperado

Redução de telas vazias, regressões silenciosas e inconsistências entre dados brutos, normalizados, gráficos e contratos de renderização. O app passa a receber uma decisão verificável, com problemas classificados por severidade e recomendações explícitas de fallback.

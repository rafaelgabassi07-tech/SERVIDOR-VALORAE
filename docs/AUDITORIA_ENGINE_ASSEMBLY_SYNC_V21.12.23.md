# Auditoria v21.12.23 — Engine Assembly Sync

## Objetivo

Continuar os aprimoramentos no `Valorae-engine.js` sem quebrar o app monitor/proxy, mantendo sincronização entre o payload produzido pelo engine e as raízes consumidas pela interface/APK/Web.

## O que mudou

- Adicionado plano interno `engineAssembly` no payload completo.
- O engine agora monta payloads por perfil de consumo:
  - `full-audit` para debug/contratos completos.
  - `standard-balanced` para respostas padrão.
  - `mobile-optimized` para `view=compact`, `mobile`, `watchlist`, `list`, `profile=fast`, `instant` e `portfolio`.
- Respostas compactas deixam de gastar CPU com auditorias pesadas que seriam removidas no fim do pipeline.
- Mesmo no modo leve, as raízes críticas do app continuam sempre geradas:
  - `appPayload`
  - `appSyncEnvelope`
  - `appMobileSnapshot`
  - `appResponseIntegrity`
- Adicionado `buildLiteConsumerDiagnostics` para manter score, fonte, tentativas e fallback sem rodar diagnóstico completo.
- Adicionado `buildLiteAppRenderContract` para preservar contrato de renderização mínimo e sincronizado com `appDataContract`.
- Atualizado monitor web para exibir política de performance, perfis ativos, cache asset e sincronização do engine.

## Ganho esperado

- Menor custo de CPU em mobile/watchlist/listas.
- Menos objetos criados para respostas compactas.
- Menos JSON intermediário antes de `applyPayloadView`.
- Menor risco de divergência entre payload completo e payload consumido pelo app.

## Compatibilidade

O contrato público do engine permanece:

```txt
VALORAE_ENGINE_VERSION = 21.12.0
```

A evolução é interna e documentada como:

```txt
21.12.23-engine-assembly-sync
```

## Garantia anti-quebra

Mesmo quando o engine pula raízes pesadas em modo compacto, ele preserva as raízes que o app usa para renderizar, sincronizar e manter cache local. O app também recebeu uma área de qualidade/performance que lê `/api/server/metrics.engine` e confirma a política ativa.

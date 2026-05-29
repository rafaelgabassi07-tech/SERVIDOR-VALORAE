# Auditoria e implementação — v21.12.25 Launch Hardening

Esta etapa converteu a auditoria de maturidade em melhorias práticas para aproximar o VALORAE Engine de um lançamento real em Web/APK.

## Implementado

- `view=app` como contrato oficial de produção para apps.
- Endpoint `/api/v1/asset/coverage?ticker=...` para medir se cotação, fundamentos, dividendos, gráficos, fonte e contratos estão prontos.
- Endpoint `/api/v1/asset/fundamentals?ticker=...` com grupos de fundamentos por cotação, valuation, dividendos, rentabilidade, balanço, liquidez e FII.
- Endpoint `/api/v1/integration/sdk` com exemplos Web/Android e regras anti-tela-vazia.
- Endpoint `/api/v1/integration/prompts` com prompts prontos para IA integrar, auditar e validar o monitor.
- Autenticação leve opcional por app/cliente via `VALORAE_CLIENT_KEYS`, `x-valorae-app-id`, `x-valorae-client-key` e assinatura HMAC opcional.
- Monitor atualizado com página de prontidão de lançamento e textos de integração usando `view=app`.
- Catálogos `/api/fields`, `/api/openapi`, `/api/manifest` e `/api/source/status` atualizados.

## Contrato recomendado para apps

Use em produção:

```text
/api/v1/asset?ticker=PETR4&view=app
```

Raízes estáveis:

```text
appMobileSnapshot -> primeira pintura
appPayload -> hidratação da tela
appSyncEnvelope -> cache/snapshot
appResponseIntegrity -> segurança de render/cache
endpointCoverage -> diagnóstico enxuto de blocos disponíveis
```

## Autenticação leve opcional

Sem variáveis, o proxy continua aberto e compatível com o uso atual.

Para preparar clientes:

```text
VALORAE_CLIENT_KEYS=web:minha-chave,apk:outra-chave
```

Para exigir autenticação:

```text
VALORAE_REQUIRE_CLIENT_AUTH=1
```

Headers recomendados:

```text
x-valorae-app-id: web
x-valorae-client-key: minha-chave
x-valorae-app: VALORAE Web
x-valorae-channel: web
x-valorae-app-version: 1.0.0
```

## Limites mantidos

- Sem banco, Redis, KV, WebSocket ou dependência paga.
- `lib/Valorae-engine.js` preservado como núcleo central.
- Contrato público `VALORAE_ENGINE_VERSION=21.12.0` mantido para compatibilidade.

# Auditoria v21.12.33 — Personal Launch Polish

## Objetivo

Polimento final para lançamento pessoal ainda hoje, sem mudar o contrato público `VALORAE_ENGINE_VERSION = 21.12.0`, sem desmembrar `lib/Valorae-engine.js` e sem adicionar dependências pagas ou obrigatórias.

## Ajustes aplicados

- CORS preparado para integração Web/APK com os headers oficiais do consumidor:
  - `x-valorae-app`
  - `x-valorae-channel`
  - `x-valorae-app-version`
  - `x-valorae-build`
  - `x-valorae-app-id`
  - `x-valorae-client-key`
  - `x-valorae-signature`
  - `x-valorae-timestamp`
- Headers de resposta importantes agora ficam expostos ao navegador:
  - `X-Valorae-Engine-Version`
  - `X-Valorae-Cache`
  - `X-Valorae-Cache-Policy`
  - `X-Valorae-Source-Status`
  - `X-Valorae-Response-Bytes`
  - `X-Valorae-Auth-Mode`
  - `X-Valorae-App-Id`
  - `X-RateLimit-*`
- Servidor local (`server.js`) ficou mais seguro para validação antes do deploy:
  - limite de corpo aplicado durante o streaming;
  - erro claro para JSON inválido;
  - headers estáticos de segurança e cache-control em arquivos públicos;
  - 403/404 com no-store.
- Endpoint `/api/v1/integration/sdk` ficou mais pronto para produção:
  - exemplo JavaScript com `AbortController` e timeout;
  - `profile=fast` como padrão para app;
  - headers de versão/build do app;
  - helper `shouldReplaceLocalCache()` para evitar regressão de cache local quando o gate mandar manter snapshot anterior;
  - raízes estáveis atualizadas com `engineLaunchGate` e `engineRuntimeProfiler`.
- `.env.example` documenta o comportamento CORS para integração Web/APK.

## Resultado da revisão

O projeto está em fase final para **uso pessoal e pessoas próximas**. Para esse escopo, o lançamento pode ocorrer hoje depois de configurar as variáveis mínimas no Vercel e validar os endpoints pós-deploy.

## O que ainda falta antes de usar no dia a dia

1. Configurar no Vercel:
   - `VALORAE_PUBLIC_BASE_URL=https://seu-deploy.vercel.app`
   - `PUBLIC_BASE_URL=https://seu-deploy.vercel.app`
   - `VALORAE_PERSONAL_MODE=true`
   - `VALORAE_DEFAULT_ASSET_VIEW=app`
   - `VALORAE_DEFAULT_ASSETS_VIEW=app`
2. Se for compartilhar fora de rede confiável:
   - `VALORAE_CLIENT_KEYS=web:sua-chave,apk:outra-chave`
   - `VALORAE_REQUIRE_CLIENT_AUTH=1`
3. Após deploy, abrir e validar:
   - `/api/v1/ready`
   - `/api/v1/release/readiness`
   - `/api/v1/source/status`
   - `/api/v1/integration/sdk`
   - `/api/server/metrics`
   - `/server.html`
4. Testar ao menos dois tickers reais no ambiente publicado:
   - `/api/v1/asset?ticker=PETR4&view=app&profile=fast`
   - `/api/v1/asset?ticker=GARE11&view=app&profile=fast`

## Limitações honestas

- No Vercel Free, caches e monitor são em memória por instância; podem reiniciar quando a Function esfriar.
- Fontes externas como Investidor10, StatusInvest, Yahoo e Google News podem oscilar, bloquear ou alterar HTML/API.
- O proxy está maduro para uso pessoal, mas ainda não substitui uma infraestrutura comercial com banco, filas, observabilidade persistente e SLA formal.

## Verificação local executada nesta revisão

- `npm run check`
- `npm test`
- `npm run build`
- `npm run build:strict`
- `npm run typecheck`
- `npm run audit:functions`
- `npm run audit:free`
- `npm run audit:version`
- `npm run audit:routes`
- `npm run audit:release`
- `npm run audit:minutiae`
- `npm run audit:recommended`
- `npm run audit:final`
- `npm run smoke`

Observação: `npm run verify` também foi iniciado, mas a sessão de ferramenta interrompeu por limite de tempo ao reexecutar toda a suíte completa. Os mesmos blocos internos do `verify` foram executados individualmente e passaram.

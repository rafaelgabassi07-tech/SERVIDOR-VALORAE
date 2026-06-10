# Relatório — Reconstrução do VALORAE Proxy e compatibilidade APK v2.0.67

## Objetivo

Reconstruir o VALORAE Proxy com identidade própria, menos peso, menos rotas físicas, sem cadeias de fallback escondidas e com compatibilidade total com o APK VALORAE.

## Decisão técnica

O Proxy foi reconstruído com arquitetura de contrato único:

```text
APK VALORAE
↓
/api/v1/mobile/portfolio-sync
↓
blocos opcionais: analysis, history, ipca, dividends, rankings
```

As rotas antigas essenciais continuam existindo, mas agora são aliases leves e previsíveis. Elas não fazem fan-out escondido nem chamam uma cadeia de fallback pesada.

## O que mudou no Proxy

- Recriação do Proxy em base enxuta.
- Redução de 73 arquivos de rota para 1 roteador central.
- Redução de 76 arquivos JS em `lib/` para 14 módulos essenciais.
- Remoção de scripts antigos, auditorias versionadas e testes legados não essenciais.
- Contrato principal preservado: `/api/v1/mobile/portfolio-sync`.
- Compatibilidade preservada para endpoints consumidos pelo APK:
  - `/api/v1/dividends/batch`
  - `/api/v1/portfolio/insights-bundle`
  - `/api/v1/portfolio/analyze`
  - `/api/v1/portfolio/history`
  - `/api/v1/market/ipca`
  - `/api/v1/market/rankings`
  - `/api/v1/asset`
  - `/api/v1/asset/dividends`
  - `/api/v1/asset/next-dividend`
  - rotas de saúde, manifesto, cache e integração.

## Lógica de proventos

A lógica foi centralizada em `lib/portfolio/dividends-contract.js`.

Regra final:

```text
Data Com / Data Ex anterior ao pregão = elegibilidade
Data de pagamento = Agenda ou Evolução
```

Fontes tratadas:

- Fonte por ticker para eventos confirmados/passados.
- Agenda pública como complemento para eventos futuros/provisionados.
- Proxy normaliza e deduplica.
- APK filtra a carteira sem fazer fan-out de rotas antigas.

## O que mudou no APK

- Atualizado para `versionName = 2.0.67` e `versionCode = 77`.
- Contrato do Proxy atualizado para `21.13.0`.
- Removido fallback oculto de `/mobile/portfolio-sync` para `/portfolio/insights-bundle` no carregamento principal.
- Fluxo de proventos do APK passa a beber apenas de `/api/v1/dividends/batch`.
- Rotas antigas continuam no Proxy como aliases compatíveis, mas o APK não duplica chamadas.

## Proxy Monitor

O monitor foi redesenhado como painel único em `public/server.html`:

- status de saúde;
- versão;
- contrato;
- cache;
- rotas principais;
- teste manual do contrato mobile.

## Validação executada

Proxy:

```text
npm run check
Checked 27 JS files

npm test
4 test files; failures=0

npm run build
Build OK para Vercel

npm run smoke
Smoke OK

npm run audit:version
Version consistency OK: 21.13.0

npm run audit:identity
Identidade VALORAE OK: 0 ocorrências externas.

npm run verify
VALORAE Proxy rebuilt v21.13.0 OK
```

APK:

```text
python3 scripts/verify_valorae_rebuilt_proxy_v2067.py
VALORAE APK v2.0.67 rebuilt proxy contract OK
```

Gradle:

```text
Bloqueado por UnknownHostException em services.gradle.org no sandbox.
```

## Estatística principal

Proxy antes v21.12.94:

- 407 arquivos;
- 38.469 linhas textuais;
- 32.892 linhas JS;
- 73 arquivos de rota;
- 76 arquivos em `lib/`.

Proxy depois v21.13.0:

- 48 arquivos;
- 1.149 linhas textuais;
- 986 linhas JS;
- 1 arquivo de rota;
- 14 arquivos em `lib/`.

Diferença:

- 359 arquivos removidos;
- 37.320 linhas textuais removidas;
- 31.906 linhas JS removidas;
- 72 arquivos de rota removidos;
- 62 arquivos de biblioteca removidos.

## Conclusão

O Proxy foi efetivamente reconstruído e simplificado. O APK foi ajustado para usar o novo contrato sem fallback oculto no fluxo principal. A compatibilidade foi preservada por aliases leves, e não por uma cadeia pesada de rotas antigas.

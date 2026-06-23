# RELATÓRIO — v104 Asset modal fast + Agenda Data COM

Data: 2026-06-22

## Objetivo

1. Aprimorar carregamento e montagem das informações nos modais dos Ativos.
2. Aprimorar a Agenda para mostrar Data COM.

## APK

Arquivos alterados:

- `app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt`
- `app/src/main/java/com/example/ui/PortfolioScreen.kt`
- `app/src/main/assets/valorae_changelog.json`
- `changelog.json`
- `version.json`
- `update.json`
- `metadata.json`

### Modais dos Ativos

- `getAnalysisPage()` ganhou parâmetro `fastMode`.
- Modais de ativos da carteira e ranking agora chamam `/api/v1/analysis` com `fastMode = true`.
- O cliente envia timeouts menores e `mode=modal_fast`, mantendo o contrato único.
- Foi adicionado fallback com cache expirado: se a rede falhar, o APK reaproveita a última análise em cache para o mesmo ticker/superfície.
- Modal de ativo da carteira agora mostra um **resumo local imediato** antes de a análise externa terminar.
- Foi incluído skeleton compacto de carregamento para reduzir sensação de tela vazia.

### Agenda

- O cabeçalho agora mostra `Ativo / Data COM`.
- A linha do evento passa a mostrar `COM <data> • Pag. <data>`.
- Se `comDate` vier vazio, o APK tenta usar `referenceDate` como data de elegibilidade de fallback.
- Parser da Agenda aceita mais aliases de Data COM: `data_com`, `dataCOM`, `dataBase`, `baseDate`, `recordDate`, `lastDateCom`, `lastDateWithRights`, `cumDate`, `dataEx`.

## Proxy

Arquivos alterados:

- `routes/_router.js`
- `lib/sources/asset-details.js`
- `lib/core/release.js`
- `metadata.json`
- `package.json`
- `PATCH_NOTES_2026_06_22_ASSET_MODAL_FAST_AGENDA_DATACOM_V104.md`

Patch atualizado:

- `21.12.154-asset-modal-fast-agenda-datacom-v104`

### Modo rápido

- `/api/v1/analysis` detecta superfícies de modal e `mode=modal_fast`.
- Para modal rápido, o Proxy usa timeouts menores e range `6M`.
- `buildAssetDetails()` pula comparadores/índices pesados quando `modal_fast` está ativo.
- O contrato final continua sendo `AnalysisPageResponse`.

## Validação

Executado no Proxy:

- `node --check routes/_router.js`: OK
- `node --check lib/sources/asset-details.js`: OK
- `node --check lib/core/release.js`: OK
- `npm run check`: OK, 251 arquivos JS verificados
- `npm test`: OK, 66 arquivos de teste, failures=0

No APK:

- JSONs principais validados.
- ZIP com arquivos na raiz para AI Studio.
- Conferência de chaves/parênteses do Kotlin alterado sem desequilíbrio.
- Build Android completa não executada porque o pacote não contém `gradlew` executável nem `gradle-wrapper.jar`.

## Versionamento

APK preservado:

- `versionCode = 26061907`
- `versionName = 2026.06.19.7`

Proxy:

- core `21.12.0`
- patch `21.12.154-asset-modal-fast-agenda-datacom-v104`

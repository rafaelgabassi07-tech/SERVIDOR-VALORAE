# RELATÓRIO — VALORAE APK v109

Data: 2026-06-22  
Checkpoint: `release-tests-sync-hardening-v109`  
APK versionCode: `26062209`  
APK versionName: `2026.06.22.9`  
Proxy pareado: `21.12.157-release-tests-sync-hardening-v109`

## Objetivo

Aplicar as correções apontadas na auditoria v108 sem quebrar a Agenda COM/EX/Pagamento nem o fluxo cloud-first já funcionando.

## Correções aplicadas

### 1. Página Análise — contrato único e testes

- Restaurados nomes/âncoras de componentes esperados pela suíte de contrato:
  - `AssetSummarySection`
  - `FundamentalIndicatorsSection`
  - `AnalysisMissingSignalsSection`
- Mantida a leitura pelo contrato único `AnalysisPageResponse`.
- Mantido carregamento de `/api/v1/analysis` somente após submissão/seleção do ticker.
- Mantida separação entre texto digitado e ticker efetivamente consultado.

### 2. Agenda de proventos — preservação COM/EX na nuvem

- `ValoraeDividendEvent` agora carrega campos separados:
  - `dateCom`
  - `exDate`
  - `inferredComDate`
  - `eligibilityDateSource`
  - `paymentDate`
- `PortfolioViewModel.toCloudDividendEventOrNull()` deixou de preencher `dateCom` com `inferredComDate`.
- Fila offline (`AssetRepository` e `ValoraeOfflineSyncManager`) preserva os novos campos.
- `ValoraeSyncClient` envia e lê os novos campos.

### 3. Visual pontual

- Corrigido contraste do selo do tipo de provento na lista de histórico de dividendos, usando `onPrimary` sobre fundo `primary`.

### 4. Versionamento e changelog

- `versionCode` atualizado para `26062209`.
- `versionName` atualizado para `2026.06.22.9`.
- Changelog atualizado em tempo real em:
  - `changelog.json`
  - `app/src/main/assets/valorae_changelog.json`
  - `version.json`
  - `update.json`
  - `metadata.json`

## Validações executadas

- JSON parse OK:
  - `metadata.json`
  - `version.json`
  - `update.json`
  - `changelog.json`
  - `app/src/main/assets/valorae_changelog.json`
- Guard textual OK: não existe mais o padrão que gravava `inferredComDate` como `dateCom` explícita no cloud event.
- Guard textual OK: Análise mantém `getAnalysisPage(submittedTicker)`, `AnalysisMissingSignalsSection`, `AssetSummarySection` e `FundamentalIndicatorsSection`.

## Limitação preservada com transparência

A build Android completa ainda não foi executada porque o pacote base não contém o Gradle wrapper oficial completo:

- ausente: `gradlew`
- ausente: `gradlew.bat`
- ausente: `gradle/wrapper/gradle-wrapper.jar`

Não foi criado um wrapper manual para evitar entregar um artefato falso ou quebrado. O projeto continua com `gradle/wrapper/gradle-wrapper.properties`, mas a build reproduzível local depende do wrapper oficial ou do ambiente AI Studio/Gradle do executor.

## Resultado

Checkpoint v109 aplicado de forma conservadora. A Agenda COM/EX/Pagamento foi preservada, a sincronização cloud-first ficou mais fiel, e os metadados do APK foram atualizados para a nova entrega.

# Complemento Proxy v109

Proxy core: `21.12.0`  
Proxy release patch: `21.12.157-release-tests-sync-hardening-v109`

## Correções específicas do Proxy

- `lib/release/current.js`, `lib/core/release.js`, `metadata.json`, `package.json`, `public/manifest.webmanifest`, `public/service-worker.js`, `scripts/audit-version.js`, `README.md`, `public/index.html` e `public/server.html` foram sincronizados para `21.12.157-release-tests-sync-hardening-v109`.
- `routes/sync.js` passou a preservar, dentro do payload cloud-first de proventos:
  - `dateCom`
  - `exDate`
  - `inferredComDate`
  - `eligibilityDateSource`
  - `paymentDate`
- `eventKey` agora considera COM estimada, EX e fonte de elegibilidade para evitar colisão entre eventos diferentes.
- `hasUsableDividendEvent` aceita evento válido quando há Data EX ou COM estimada, sem exigir que a Data COM explícita exista.

## Validações Proxy executadas

- `npm run check` — OK
- `npm test` — OK, 66 arquivos de teste, `failures=0`
- `npm run audit:identity` — OK
- `npm run audit:version` — OK
- `npm run build` — OK
- `npm run typecheck` — OK
- `npm run verify` — OK

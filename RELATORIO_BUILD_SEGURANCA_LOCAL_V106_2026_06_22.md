# RELATÓRIO — v106 Build, testes e segurança local

Data: 2026-06-22  
Checkpoint: `build-security-local-v106`  
APK base: `apk_valorae_comparacao_favoritos_funcional_v105`  
Proxy base: `valorae_proxy_21_12_154_asset-modal-fast-agenda-datacom-v104`

## Objetivo

Aplicar o próximo checkpoint recomendado na auditoria completa do App, focado em base técnica, segurança local, metadados de release e verificação do Proxy.

## APK — mudanças aplicadas

### 1. Backup Android desativado

Arquivo alterado:

- `app/src/main/AndroidManifest.xml`

Alteração:

- `android:allowBackup="true"` foi alterado para `android:allowBackup="false"`.

Motivo:

- O Valorae tem política cloud-first: Supabase é a fonte principal; Room, SharedPreferences e caches locais são temporários.
- O backup Android não deve carregar tokens, sessão Supabase, banco local, cache ou estado antigo entre aparelhos/contas.

### 2. Regras de backup/data extraction endurecidas

Arquivos alterados:

- `app/src/main/res/xml/backup_rules.xml`
- `app/src/main/res/xml/data_extraction_rules.xml`

Alteração:

- Exclusão de `database`, `sharedpref`, `file` e `external` para backup em nuvem e transferência de aparelho.

Motivo:

- Evitar que dados locais antigos sejam restaurados depois de logout/login.
- Reduzir risco de dados sensíveis em backup automático.

### 3. Keystore debug corrigido para o pacote atual

Arquivo alterado:

- `app/build.gradle.kts`

Alteração:

- A assinatura debug agora prioriza `app/virtual_debug.keystore`.
- Mantém fallback para `debug.keystore` na raiz se existir.

Motivo:

- A auditoria apontou que o Gradle referenciava `../debug.keystore`, mas o pacote entregue continha `app/virtual_debug.keystore`.

### 4. Metadados sincronizados

Arquivos alterados:

- `changelog.json`
- `app/src/main/assets/valorae_changelog.json`
- `version.json`
- `update.json`
- `metadata.json`

Alteração:

- Adicionado checkpoint v106 no changelog.
- Sincronizados título, resumo, checkpoint e notas de manutenção.
- `versionCode` e `versionName` foram preservados.

Valores preservados:

- `versionCode = 26061907`
- `versionName = 2026.06.19.7`

## Proxy — mudanças aplicadas

### 1. Auditoria de versão corrigida

Arquivo alterado:

- `scripts/audit-version.js`

Alteração:

- O script agora valida o patch atual `21.12.155-build-security-v106` em vez do checkpoint antigo v57.

### 2. Metadados de release sincronizados

Arquivos alterados:

- `package.json`
- `metadata.json`
- `lib/core/release.js`
- `public/manifest.webmanifest`
- `public/service-worker.js`

Novo patch do Proxy:

- `21.12.155-build-security-v106`

### 3. Arquivo de backup removido

Removido:

- `lib/analysis/analysis-page-response.js.bak`

Motivo:

- Evitar arquivo morto em entrega de produção/AI Studio.

## Validação executada

### APK

- JSONs validados:
  - `changelog.json`
  - `app/src/main/assets/valorae_changelog.json`
  - `version.json`
  - `update.json`
  - `metadata.json`
- XMLs validados:
  - `AndroidManifest.xml`
  - `backup_rules.xml`
  - `data_extraction_rules.xml`
- Confirmado:
  - `android:allowBackup="false"`
  - `app/virtual_debug.keystore` existe no pacote
  - ZIP com arquivos diretamente na raiz

### Proxy

Comandos executados com sucesso:

- `npm run audit:version`
- `npm run check`
- `npm run build`
- `npm run typecheck`
- `npm test`

Resultado do teste:

- `66 test files; failures=0`

## Limitações restantes

- Build Android completa ainda não foi executada porque o pacote não contém `gradlew` executável nem `gradle-wrapper.jar`.
- A correção do keystore remove um erro de configuração observado na auditoria, mas não substitui uma build real em ambiente Android/Gradle completo.
- A refatoração estrutural dos arquivos Kotlin grandes (`PortfolioScreen.kt`, `AnalysisScreen.kt`, `SettingsPages.kt`) permanece pendente para checkpoints futuros.

## Próximo checkpoint recomendado

`v107 — Análise sem resquícios de abas + sinalização discreta`

Escopo sugerido:

- Remover qualquer texto/conceito antigo de abas da Análise.
- Reintroduzir sinalização discreta de dados ausentes/não integrados.
- Atualizar testes relacionados à Análise quando necessário.

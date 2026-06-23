# RELATÓRIO — VALORAE v108

## Checkpoint
**v108 — Agenda COM/EX/Pagamento robusta**

## Objetivo
Separar corretamente **Data COM**, **Data EX** e **Data de Pagamento** na Agenda, evitando que o app mostre Data EX como se fosse Data COM. O checkpoint também preserva elegibilidade/deduplicação quando a fonte entregar apenas Data EX, mas com sinalização explícita.

## Mudanças no APK

### Modelos e parser
- `ValoraeDividend` agora possui `exDate`, `inferredComDate` e `eligibilityDateSource`.
- `ValoraeDividendAgendaEvent` agora possui `exDate`, `inferredComDate` e `eligibilityDateSource`.
- `ValoraeProxyClient.parseDividendAgendaEvents()` deixou de usar `exDate`/`dataEx` como fallback direto de `comDate`.
- `exDate` passa a ser preservada em campo próprio.
- `inferredComDate` passa a ser lida quando o Proxy informar COM estimada.

### Agenda
- Cabeçalho alterado de **Ativo / Data COM** para **Ativo / datas**.
- Linha do evento agora mostra:
  - `COM <data>` quando houver Data COM explícita;
  - `COM estim. <data>` quando a COM foi inferida pelo Proxy;
  - `COM não informada` quando não houver COM;
  - `EX <data>` quando houver Data EX;
  - `Pag. <data>` para pagamento.
- `referenceDate`/competência não é mais exibido como Data COM.

### Cálculo e deduplicação
- `DividendAgendaCalculator` agora usa `bestEligibilityDateForAgenda()` para elegibilidade/deduplicação.
- A melhor data de elegibilidade considera: COM explícita → COM estimada → EX.
- A exibição visual continua separando COM e EX para não induzir o usuário a erro.
- Teste unitário adicionado para garantir que evento com EX-only não vire COM explícita.

### Sincronização
- `PortfolioViewModel.toCloudDividendEventOrNull()` deixou de preencher `dateCom` com `referenceDate`.
- Agora usa apenas `comDate` explícita ou `inferredComDate`, preservando a diferença entre competência e elegibilidade.

## Mudanças no Proxy

### Rotas de agenda/proventos
- `routes/portfolio/next-dividends.js`
- `routes/portfolio/dividends.js`

Mudanças:
- `dateCom` passa a receber apenas Data COM explícita ou data genérica segura.
- `exDate` passa a ser enviada separadamente.
- Quando a fonte só entrega Data EX, o Proxy calcula `inferredComDate` como dia útil anterior e marca `eligibilityDateSource = exDate-previous-business-day`.
- A classificação de eventos futuros passa a considerar `inferredComDate`/`exDate` para não perder eventos sem COM explícita.

### Contrato de dividendos
- `lib/portfolio/dividends-contract.js` não grava mais `exDate` como `comDate`.
- `exDate` e `inferredComDate` são preservadas separadamente.

### Release
- Proxy atualizado para:
  - `21.12.156-agenda-com-ex-payment-v108`

## Versionamento APK
Preservado:
- `versionCode = 26061907`
- `versionName = 2026.06.19.7`

## Validação executada

### APK
- JSONs validados:
  - `metadata.json`
  - `version.json`
  - `update.json`
  - `changelog.json`
  - `app/src/main/assets/valorae_changelog.json`
- XMLs do app validados via parser XML.
- Verificação estrutural dos Kotlin alterados.
- Teste unitário adicionado em `DividendAgendaCalculatorTest.kt`.

Limitação: build Android completa não foi executada porque o pacote segue sem `gradlew` executável e sem `gradle-wrapper.jar`.

### Proxy
Comandos executados com sucesso:
- `npm run audit:version`
- `npm run check`
- `npm run build`
- `npm run typecheck`
- `npm test`

Resultado dos testes do Proxy:
- **66 test files; failures=0**

## Arquivos principais alterados

APK:
- `app/src/main/java/com/example/data/proxy/ValoraeProxyModels.kt`
- `app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt`
- `app/src/main/java/com/example/domain/DividendAgendaCalculator.kt`
- `app/src/main/java/com/example/ui/PortfolioScreen.kt`
- `app/src/main/java/com/example/ui/PortfolioViewModel.kt`
- `app/src/test/java/com/example/domain/DividendAgendaCalculatorTest.kt`
- `metadata.json`, `version.json`, `update.json`, `changelog.json`, `valorae_changelog.json`

Proxy:
- `routes/portfolio/next-dividends.js`
- `routes/portfolio/dividends.js`
- `lib/portfolio/dividends-contract.js`
- `lib/core/release.js`
- `scripts/audit-version.js`
- `package.json`
- `metadata.json`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `PATCH_NOTES_2026_06_22_AGENDA_COM_EX_PAYMENT_V108.md`

## Caveat
Quando a fonte só entrega Data EX, a Data COM estimada é útil para elegibilidade, mas visualmente aparece como **COM estim.**, não como Data COM oficial.

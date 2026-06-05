# VALORAE — Upgrade Faturamento por Negócio/Região

**Data:** 2026-06-04  
**App:** v2.0.6 / `versionCode = 16`  
**Proxy:** `21.12.58-revenue-breakdowns-app-contract`  
**Foco:** corrigir a origem real dos gráficos **Faturamento por Negócio** e **Faturamento por Região** sem simular dados.

## Diagnóstico

A falha não era apenas no app. O app v2.0.5 já aceitava vários formatos, mas o Proxy não garantia que os agrupamentos percentuais fossem expostos de forma estável nos contratos consumidos pelo Android.

O problema identificado foi:

- `negociosReceita`, `segmentosReceita`, `revenueByBusiness`, `revenueSegment`, `regioesReceita` e `revenueGeography` podiam estar ausentes, vazios ou presos em blocos não priorizados pelo contrato mobile.
- O `appPayload.charts` não tinha uma área explícita e estável para faturamento por negócio/região.
- O `appMobileSnapshot` não preservava estes agrupamentos para primeira renderização.
- O `assetClassContract.groups.statements` não listava esses campos como parte formal das demonstrações/séries financeiras da ação.

Como o VALORAE não pode inventar dados, o app corretamente não tinha fatias para montar os donuts quando o Proxy não entregava os agrupamentos.

## Correções no VALORAE Proxy

### Arquivos alterados

- `lib/Valorae-engine.js`
- `lib/quality/app-consumer-payload.js`
- `lib/quality/app-mobile-snapshot.js`
- `lib/quality/asset-class-contract.js`
- `metadata.json`
- `package.json`
- `test/revenue-breakdowns-app-contract-v21-12-58.test.js`

### Melhorias implementadas

1. **Extração mais robusta dos blocos de faturamento**

O Proxy agora procura blocos JSON/JS embutidos relacionados a:

- `companyRevenuesChartPie`
- `companyBussinesRevenuesChartPie`
- `companyBusinessRevenuesChartPie`
- nomes com `revenue`, `receita`, `faturamento`, `business`, `bussines`, `negocio`, `segment`, `geography`, `region`, `regiao`
- atributos `data-*` que carreguem JSON de gráficos

A extração usa leitura balanceada de objetos/arrays JS-like, evitando depender apenas de regex curta que pode falhar em objetos aninhados.

2. **Aliases estáveis no `results`**

Quando o Proxy encontra os agrupamentos, ele passa a preencher múltiplos aliases compatíveis:

Para região:

- `results.revenueGeography`
- `results.regioesReceita`
- `results.sections.empresa.regioesReceita`
- `results.sections.empresa.revenueGeography`

Para negócio/segmento:

- `results.revenueSegment`
- `results.revenueByBusiness`
- `results.negociosReceita`
- `results.segmentosReceita`
- `results.sections.empresa.negociosReceita`
- `results.sections.empresa.segmentosReceita`
- `results.sections.empresa.revenueSegment`
- `results.sections.empresa.revenueByBusiness`

3. **Contrato oficial para o app em `appPayload.charts`**

O `appPayload.charts` agora inclui explicitamente:

- `revenueBreakdowns`
- `revenueGeography`
- `regioesReceita`
- `revenueByRegion`
- `revenueSegment`
- `revenueByBusiness`
- `negociosReceita`
- `segmentosReceita`

Também inclui estado vazio seguro quando a fonte não entregar o dado.

4. **Snapshot mobile compatível**

O `appMobileSnapshot` agora preserva:

- `appMobileSnapshot.revenueBreakdowns.revenueGeography`
- `appMobileSnapshot.revenueBreakdowns.regioesReceita`
- `appMobileSnapshot.revenueBreakdowns.revenueByRegion`
- `appMobileSnapshot.revenueBreakdowns.revenueSegment`
- `appMobileSnapshot.revenueBreakdowns.revenueByBusiness`
- `appMobileSnapshot.revenueBreakdowns.negociosReceita`
- `appMobileSnapshot.revenueBreakdowns.segmentosReceita`

5. **AssetClassContract atualizado**

O grupo `statements` passou a declarar como campos formais:

- `regioesReceita`
- `negociosReceita`
- `revenueGeography`
- `revenueSegment`
- `revenueByBusiness`

Isso permite o app saber se o dado existe, qual é a fonte e se deve renderizar ou mostrar indisponibilidade.

6. **Teste de regressão criado**

Criado:

```bash
node test/revenue-breakdowns-app-contract-v21-12-58.test.js
```

Ele valida que:

- `appPayload.charts.revenueBreakdowns.hasRegion = true`
- `appPayload.charts.revenueBreakdowns.hasBusiness = true`
- `appPayload.charts.revenueGeography` existe
- `appPayload.charts.revenueByBusiness` existe
- `appMobileSnapshot.revenueBreakdowns` preserva os dois agrupamentos
- `assetClassContract.groups.statements` marca os campos como presentes

## Correções no APK VALORAE

### Arquivos alterados

- `app/build.gradle.kts`
- `app/src/main/java/com/example/network/B3NetworkService.kt`
- `scripts/verify_valorae_ui_v206.py`
- `update.json`

### Melhorias implementadas

1. **Parser Android ampliado para novos contratos do Proxy**

O app agora procura faturamento por região em:

- `results.regioesReceita`
- `results.geografiaReceita`
- `results.revenueGeography`
- `results.revenueByRegion`
- `results.distribuicaoFaturamento.regioes`
- `results.distribuicaoFaturamento.regioesReceita`
- `appPayload.charts.revenueGeography`
- `appPayload.charts.regioesReceita`
- `appPayload.charts.revenueByRegion`
- `appPayload.charts.revenueBreakdowns.revenueGeography`
- `appPayload.charts.revenueBreakdowns.regioesReceita`
- `appPayload.charts.revenueBreakdowns.revenueByRegion`
- `appMobileSnapshot.revenueBreakdowns.revenueGeography`
- `appMobileSnapshot.revenueBreakdowns.regioesReceita`
- `appMobileSnapshot.revenueBreakdowns.revenueByRegion`
- `assetClassContract.groups.statements.fields.regioesReceita.value`
- `assetClassContract.groups.statements.fields.revenueGeography.value`

O app agora procura faturamento por negócio em:

- `results.negociosReceita`
- `results.segmentosReceita`
- `results.revenueSegment`
- `results.revenueByBusiness`
- `results.distribuicaoFaturamento.negocios`
- `results.distribuicaoFaturamento.negociosReceita`
- `results.distribuicaoFaturamento.segmentosReceita`
- `appPayload.charts.revenueSegment`
- `appPayload.charts.revenueByBusiness`
- `appPayload.charts.negociosReceita`
- `appPayload.charts.segmentosReceita`
- `appPayload.charts.revenueBreakdowns.revenueSegment`
- `appPayload.charts.revenueBreakdowns.revenueByBusiness`
- `appPayload.charts.revenueBreakdowns.negociosReceita`
- `appPayload.charts.revenueBreakdowns.segmentosReceita`
- `appMobileSnapshot.revenueBreakdowns.revenueSegment`
- `appMobileSnapshot.revenueBreakdowns.revenueByBusiness`
- `appMobileSnapshot.revenueBreakdowns.negociosReceita`
- `appMobileSnapshot.revenueBreakdowns.segmentosReceita`
- `assetClassContract.groups.statements.fields.negociosReceita.value`
- `assetClassContract.groups.statements.fields.revenueSegment.value`
- `assetClassContract.groups.statements.fields.revenueByBusiness.value`

2. **Sem simulação**

Nenhuma fatia de faturamento foi criada localmente. O app continua exibindo vazio/indisponível se o Proxy não retornar dados válidos.

3. **Versão atualizada**

- `versionCode = 16`
- `versionName = 2.0.6`

4. **Auditoria Android criada**

Criado:

```bash
python3 scripts/verify_valorae_ui_v206.py
```

Ela valida:

- versão 2.0.6/code 16;
- aba Negócios preservada;
- DRE preservado;
- leitura de `appPayload.charts.revenueBreakdowns`;
- leitura de `appMobileSnapshot.revenueBreakdowns`;
- leitura de aliases `distribuicaoFaturamento`;
- ausência de simulações proibidas.

## Validações executadas

### Proxy

```text
npm run check
Checked 286 JS files
```

```text
npm test
VALORAE test runner: 88 arquivos executados; falhas=0; lentos=nenhum
```

### App

```text
python3 scripts/verify_valorae_ui_v206.py
VALORAE UI v2.0.6 revenue breakdown audit OK
```

```text
XML OK: 12 arquivos válidos
```

### Gradle

O Gradle foi executado, mas o ambiente não consegue resolver DNS externo:

```text
UnknownHostException: services.gradle.org
```

Portanto, não foi possível compilar o APK neste ambiente. Não há afirmação falsa de build concluído.

## Resultado esperado após deploy do Proxy

Depois de publicar o Proxy atualizado na Vercel, o endpoint:

```text
/api/v1/asset?ticker=WEGE3&complete=1
```

ou a variação usada pelo app com `view=analysis/profile=analysis` deverá expor, quando a fonte entregar os dados:

- faturamento por negócio;
- faturamento por região;
- aliases compatíveis no `results`;
- aliases compatíveis no `appPayload.charts`;
- aliases compatíveis no `appMobileSnapshot.revenueBreakdowns`;
- presença em `assetClassContract.groups.statements`.

Se a fonte pública não entregar o agrupamento em uma chamada específica, o app continuará sem inventar dados e mostrará estado vazio/indisponível.

## Observação crítica

A correção do app v2.0.6 depende do Proxy atualizado. Se apenas o APK for atualizado e o Proxy público continuar em versão anterior, os gráficos de **Faturamento por Negócio** e **Faturamento por Região** continuarão vazios quando o payload público não tiver os agrupamentos.

A ordem correta é:

1. Fazer deploy do Proxy `21.12.58-revenue-breakdowns-app-contract` na Vercel.
2. Instalar/compilar o app `2.0.6`.
3. Testar com `WEGE3`, `VALE3`, `RDOR3` e outros tickers com breakdown disponível.

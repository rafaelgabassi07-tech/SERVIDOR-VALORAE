# Relatório técnico — VALORAE gráficos Detalhes do Ativo / Análise

**Rodada:** APK VALORAE v2.0.56 + Valorae Proxy v21.12.84  
**Foco:** caminhos dos gráficos das páginas **Detalhes do ativo** e **Análise**, incluindo rentabilidade, comparação com índices, DRE/finanças, proventos, payout, gráficos de FIIs e histórico de preço.  
**Regra preservada:** não renomear o projeto, não alterar pacote/base/raiz, manter compatibilidade com Google AI Studio.

---

## 1. Diagnóstico profundo

A auditoria anterior já mostrava que o VALORAE precisava seguir um fluxo mais próximo do AeroScrape + Vesto: carregar o último dado bom primeiro, revalidar em segundo plano e nunca apagar blocos bons por uma resposta vazia/parcial. Nesta nova rodada, o problema específico foi encontrado no fluxo dos gráficos.

### 1.1 Fluxo anterior provável

```text
APK / Análise ou Detalhes
↓
B3NetworkService.fetchAssetChartBundle()
↓
GET /api/v1/asset?view=app&includeCharts=1&profile=chartfast/chartdeep
↓
Proxy monta assetChartsCanonical em results/sections
↓
applyPayloadView(view=app) compacta a resposta oficial
↓
APK tenta localizar blocos em várias raízes antigas
↓
Alguns gráficos chegam vazios quando a raiz canônica foi compactada ou não espelhada
```

### 1.2 Principais riscos encontrados

1. **Contrato de gráficos não era explícito o bastante para mobile.**  
   O Proxy tinha `assetChartsCanonical`, `chartsFinanceiros`, `sections.demonstrativos` e outros aliases, mas a visão `app` podia entregar um payload mais compacto sem uma raiz única garantida para os gráficos avançados.

2. **A tela Análise dependia demais de `chartHistory`.**  
   Se `/api/v1/asset/history` retornasse vazio, a tela podia ficar sem gráfico mesmo quando o bundle do ativo já possuía histórico ou outros dados de gráfico.

3. **Troca de período podia apagar histórico bom.**  
   Em `changeSearchChartRange`, uma resposta vazia substituía `_searchQueryHistory`, gerando tela vazia ao trocar período.

4. **FIIs não recebiam deep refresh suficiente.**  
   A função `needsDeepFinancialRefresh` retornava `false` para FII, então FIIs com gráficos de distribuição, patrimonial, DY, peer average ou IFIX incompletos podiam não acionar busca profunda.

5. **Detalhes do ativo tinha fallback limitado no gráfico de preço.**  
   Quando o histórico local do range atual falhava, a modal não usava sempre o `priceHistory` já recebido no bundle.

---

## 2. Referência AeroScrape + Vesto aplicada

### 2.1 AeroScrape

O AeroScrape trabalha com um padrão robusto de cache/dedupe/batch:

```text
requisição equivalente em andamento
↓
coalesce/in-flight
↓
resultado cacheado ou stale
↓
resposta parcial com diagnóstico
```

Aplicação no VALORAE:

- manter o cache result/stale do Proxy;
- criar contrato explícito para não depender de múltiplos aliases;
- preservar último gráfico bom no APK;
- impedir que uma resposta vazia substitua uma série já renderizável.

### 2.2 Vesto

O Vesto reforça a ideia de renderização segura:

```text
abrir ativo
↓
zerar estado apenas para o ativo correto
↓
renderizar depois que o container existe
↓
usar cache/local quando rede falha
↓
não misturar gráfico de ativo anterior
```

Aplicação no VALORAE:

- `AssetDetailModal` mantém estado por `tickerKey`;
- a nova lógica usa fallback do bundle quando o histórico direto falha;
- `AnalysisScreen` passa a diferenciar carregamento, histórico direto e snapshot do bundle;
- o ViewModel não apaga histórico bom por resposta vazia.

---

## 3. Correções aplicadas no Valorae Proxy v21.12.84

### 3.1 Nova raiz canônica mobile: `assetChartBundle`

Foi criado um contrato explícito de gráficos para o APK:

```json
{
  "assetChartBundle": {
    "ticker": "PETR4",
    "type": "ACAO",
    "range": "MAX",
    "priceHistory": [],
    "profitability": [],
    "realProfitability": [],
    "dividendEvents": [],
    "dividendMonthly": [],
    "dividendYearly": [],
    "dividendYieldHistory": [],
    "indexComparison": [],
    "commodityComparison": [],
    "revenueProfit": [],
    "profitVsQuote": [],
    "equityEvolution": [],
    "balanceSheet": [],
    "payoutHistory": [],
    "revenueByRegion": {},
    "revenueByBusiness": {},
    "fiiDistribution12m": [],
    "fiiPeerAverage": [],
    "fiiPatrimonialInfo": [],
    "fiiAssetDistribution": {},
    "coverageCaptured": [],
    "coverageMissing": [],
    "sourceStatus": {}
  }
}
```

### 3.2 Espelhamento em raízes compatíveis

Para não quebrar consumidores antigos, o mesmo bundle é espelhado em:

```text
assetChartBundle
assetChartsMobile
results.assetChartBundle
results.sections.assetChartBundle
appPayload.assetChartBundle
appPayload.charts.assetChartBundle
appMobileSnapshot.assetChartBundle
```

Assim o APK pode consumir o caminho direto, mas versões antigas ainda encontram dados por aliases.

### 3.3 A visão `app` não perde mais o bundle

`buildOfficialAppView` foi ajustado para preservar `assetChartBundle` mesmo após compactação de payload.

### 3.4 Normalização dos blocos avançados

O Proxy agora converte o `assetChartsCanonical` para o formato que o APK já entende:

- `AssetPeriodReturn` para rentabilidade nominal/real;
- `AssetComparisonSeries` para índice/commodity;
- `FinancialStatementPoint` para DRE, lucro x cotação, evolução patrimonial e balanço;
- `AssetIndicatorPoint` para dividendos, DY, payout e blocos FII;
- `AssetBreakdownPoint` para receita por região/negócio e distribuição de ativos FII;
- `DividendEvent` para histórico oficial de proventos do ativo.

### 3.5 Diagnóstico e contagem

O bundle inclui:

```text
sourceStatus
counts
coverageCaptured
coverageMissing
coverageNotApplicable
warnings
```

Isso permite o APK saber se o problema é ausência real de dados, parcialidade da fonte ou falha de extração.

---

## 4. Correções aplicadas no APK VALORAE v2.0.56

### 4.1 Parser direto para `assetChartBundle`

`B3NetworkService.parseAssetChartBundle` agora procura primeiro a raiz canônica direta:

```text
assetChartBundle
assetChartsMobile
results.assetChartBundle
results.assetChartsMobile
results.sections.assetChartBundle
appPayload.assetChartBundle
appPayload.charts.assetChartBundle
appMobileSnapshot.assetChartBundle
```

Depois, faz merge com o parser legado. Assim o app usa o contrato novo sem perder compatibilidade com respostas antigas.

### 4.2 Merge direct + legacy

Foi adicionado `mergeParsedAssetChartBundle`, que preserva a fonte mais rica por bloco:

```text
se direct tem revenueProfit → usa direct
senão usa legado
se direct tem indexComparison → usa direct
senão usa legado
se direct tem dividendYearly → usa direct
senão usa fallback antigo
```

### 4.3 Tela Análise: fallback stale-safe de histórico

Antes:

```text
se chartHistory vazio → não renderiza gráfico
```

Agora:

```text
se chartHistory existir → usa histórico direto
senão se bundle.priceHistory existir → usa snapshot do bundle
senão mostra estado de carregamento/indisponibilidade sem apagar blocos bons
```

### 4.4 Troca de período não apaga série boa

`changeSearchChartRange` deixou de substituir `_searchQueryHistory` quando a nova resposta vem vazia. Isso evita o efeito:

```text
troca 1Y → MAX
↓
Proxy demora/retorna vazio
↓
gráfico anterior desaparece
```

Agora a série anterior permanece até chegar uma série nova válida.

### 4.5 Detalhes do Ativo: fallback pelo bundle

Na modal, o gráfico de preço usa:

```text
localChartPoints
↓ se vazio
chartBundle.priceHistory
```

Isso evita uma área vazia quando o endpoint de histórico falha, mas o bundle do ativo ainda tem dados renderizáveis.

### 4.6 FIIs agora podem acionar deep refresh

A lógica antiga impedia refresh profundo para FII. Agora FIIs são avaliados por critérios próprios:

```text
rentabilidade / comparação IFIX
proventos mensais/anuais/eventos
DY histórico / distribuição 12m
informações patrimoniais
média do segmento / peer average
distribuição de ativos/imóveis
```

Se o FII não atingir um mínimo de completude, o ViewModel chama o modo profundo.

---

## 5. Fluxo correto após a correção

```text
Usuário abre Análise ou Detalhes do Ativo
↓
APK pede histórico rápido de preço e bundle de gráficos
↓
Proxy consulta /api/v1/asset em chartfast/chartdeep
↓
Proxy extrai assetChartsCanonical do Investidor10/APIs internas
↓
Proxy monta assetChartBundle mobile explícito
↓
APK lê assetChartBundle diretamente
↓
APK faz merge com parser legado e cache local
↓
UI renderiza o que estiver pronto e mantém último gráfico bom se a fonte vier vazia/parcial
```

---

## 6. Arquivos principais alterados

### APK

```text
app/build.gradle.kts
metadata.json
app/src/main/java/com/example/network/B3NetworkService.kt
app/src/main/java/com/example/viewmodel/PortfolioViewModel.kt
app/src/main/java/com/example/ui/screens/AnalysisScreen.kt
app/src/main/java/com/example/ui/components/AssetDetailModal.kt
app/docs/APK_BUILD_ATTEMPT_ASSET_CHART_FLOW_v2.0.56.log
```

### Proxy

```text
package.json
metadata.json
lib/Valorae-engine.js
lib/quality/app-official-view.js
lib/market/investidor10-chart-extractor.js
docs/PROXY_CHECK_ASSET_CHART_FLOW_v21.12.84.log
```

---

## 7. Validação

### Proxy

```text
npm run check
Checked 295 JS files
```

Resultado: **válido sintaticamente**.

### APK

Foi executado:

```text
./gradlew test --no-daemon
```

O ambiente não conseguiu baixar o Gradle em `services.gradle.org`, resultando em `UnknownHostException`. Isso é limitação de rede do sandbox. O log foi salvo no projeto:

```text
app/docs/APK_BUILD_ATTEMPT_ASSET_CHART_FLOW_v2.0.56.log
```

---

## 8. Observações finais

Esta rodada não fabricou dados sintéticos. O objetivo foi garantir que dados reais já extraídos pelo Proxy cheguem ao APK por um caminho estável, explícito e compatível.

A principal mudança arquitetural é:

```text
assetChartsCanonical interno do Proxy
↓
assetChartBundle mobile explícito
↓
parser direto no APK
↓
merge com parser legado
↓
UI stale-safe sem apagar gráfico bom
```

Isso melhora os gráficos das páginas **Detalhes do Ativo** e **Análise** sem mudar a árvore do projeto nem quebrar a compatibilidade com o Google AI Studio.

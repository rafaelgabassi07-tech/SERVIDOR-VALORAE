# Relatório técnico — Estudo e otimização de fluxo VALORAE APK + Valorae Proxy

## Escopo desta rodada

Esta rodada analisou o projeto VALORAE atualizado na rodada anterior, o Valorae Proxy, o relatório de auditoria AeroScrape/Vesto e os projetos de referência `AeroScrape-main` e `Vesto (2).apk`. A intervenção foi conservadora: preservar nomes, árvore, rotas antigas, `applicationId`, Gradle, estrutura do Proxy e compatibilidade com Google AI Studio.

O objetivo foi melhorar desempenho e correção lógica nas páginas/fluxos de:

- proventos passados e evolução de renda;
- agenda de proventos futuros;
- alocação/diversificação;
- histórico patrimonial;
- IPCA/IPCA+;
- integração APK ↔ Proxy;
- cache, timeout, modo rápido e modo profundo.

## Referências extraídas dos projetos do seu irmão

### AeroScrape

O AeroScrape confirma três padrões bons para o VALORAE:

1. **Batch e coalescing**: agrupar chamadas semelhantes e evitar várias consultas iguais simultâneas.
2. **Cache com status explícito**: retornar `HIT`, `STALE`, `MISS` ou equivalente para a UI saber se está vendo dado fresco ou preservado.
3. **Circuit/deadline mental model**: uma fonte lenta não deve derrubar a experiência. O app recebe parcial/cache e continua vivo.

No VALORAE isso foi aplicado nos fluxos de proventos, IPCA, alocação e histórico.

### Vesto

O Vesto reforça um fluxo mais resiliente:

```text
abrir com dados conhecidos
↓
calcular tela localmente
↓
revalidar rede em background
↓
atualizar blocos sem apagar dados bons
```

Foram observados caches locais/IndexedDB, `proventosConhecidos`, IPCA cacheado e uso de dados conhecidos para montar páginas sem depender 100% da rede no momento da abertura.

## Diagnóstico principal no VALORAE

### 1. Modo profundo (`deepSync`) estava inconsistente no APK

Havia chamadas de análise, histórico e IPCA montando payload com `deepSync`, mas algumas funções não recebiam esse parâmetro corretamente. Isso é crítico porque afeta compilação e execução de chamadas remotas.

**Correção aplicada:**

- `fetchPortfolioAnalysis(..., deepSync: Boolean = false)`
- `fetchPortfolioHistory(..., deepSync: Boolean = false)`
- `fetchIpcaSeries(..., deepSync: Boolean = false)`
- chamadas no `PortfolioViewModel` agora repassam `deepSync = force`.

### 2. Timeouts do APK não batiam com o modo Proxy

O APK pedia modo profundo, mas o orçamento local cancelava antes de o Proxy terminar. Isso gerava fallback prematuro e páginas incompletas.

**Correção aplicada:**

- modo rápido continua curto para preservar fluidez;
- modo profundo ganhou orçamento maior;
- `fetchNextDividends` agora recebe `deepSync = force` quando o usuário força sincronização.

### 3. Proventos passados e futuros precisavam de separação mais forte na UI

O VALORAE já tinha blocos separados, mas a tela de Proventos ainda podia priorizar `dividendEvents` bruto em alguns gráficos/KPIs. Isso mistura histórico oficial do ativo com renda realmente elegível da carteira.

**Correção aplicada:**

- Proventos usa primeiro `portfolioReceivedDividends`;
- se esse bloco ainda não existir, usa `dividendEvents` como fallback compatível;
- Agenda continua priorizando `portfolioUpcomingDividends`.

### 4. IPCA precisava de contrato mais estável e cálculo composto

O Proxy já consultava BCB/SGS, mas o retorno precisava ser mais amigável ao mobile e o acumulado deve ser composto, não uma soma linear.

**Correção aplicada no Proxy:**

- normalização de data `dd/MM/yyyy` para ISO;
- ordenação cronológica;
- `monthlyPercent` e `accumulatedPercent` por ponto;
- aliases `points`, `series`, `items`;
- cálculo acumulado composto.

### 5. Histórico da carteira precisava respeitar data de entrada

Histórico patrimonial não deve contar um ativo antes da primeira compra do usuário. Também precisava retornar aliases claros para o APK.

**Correção aplicada no Proxy:**

- `firstPurchaseAt` preservado na normalização;
- pontos anteriores à compra são ignorados;
- `investedValue` passa a ser calculado por linha/dia conforme ativos já elegíveis;
- aliases adicionados: `returnPercent`, `returnPct`, `unrealizedPnLPct`, `unrealizedPnLPercent`, `points`, `history`.

### 6. Alocação precisava de deadline e parcial seguro

A rota de alocação podia gastar tempo demais se o cálculo ou fonte externa demorasse.

**Correção aplicada no Proxy:**

- deadline por rota;
- fallback parcial com blocos vazios e diagnóstico;
- cache-control com `stale-while-revalidate` maior;
- modo compacto/mobile com concorrência controlada.

### 7. Proventos precisavam de diagnóstico melhor

O batch de proventos já existia, mas precisava expor melhor contagem/status e indicar casos em que há cache porém a agenda ao vivo veio vazia.

**Correção aplicada no Proxy:**

- `sourceStatus` no payload;
- `counts` com oficiais/histórico/recebidos/futuros;
- `partial=true` também quando agenda ao vivo vem vazia mas existe cache oficial;
- classificação de units B3 preservada como `ACAO_UNIT` no APK/Proxy, sem tratar automaticamente todo ticker terminado em `11` como FII.

## Arquivos principais alterados

### APK

- `app/src/main/java/com/example/network/B3NetworkService.kt`
- `app/src/main/java/com/example/viewmodel/PortfolioViewModel.kt`
- `app/src/main/java/com/example/ui/screens/ChartsScreen.kt`
- `app/build.gradle.kts`
- `version.json`
- `update.json`

### Proxy

- `lib/market/bcb.js`
- `lib/portfolio/history.js`
- `routes/portfolio/allocation.js`
- `routes/dividends/batch.js`
- `package.json`

## Contrato recomendado APK ↔ Proxy após esta rodada

### Proventos

```json
{
  "officialEvents": [],
  "assetHistory": [],
  "portfolioReceived": [],
  "portfolioUpcoming": [],
  "sourceStatus": {},
  "counts": {},
  "partial": false,
  "cacheStatus": "HIT|STALE|LIVE|MISS"
}
```

Regra de UI:

- evolução de proventos usa `portfolioReceived`;
- histórico oficial usa `assetHistory`/`officialEvents`;
- agenda usa `portfolioUpcoming`;
- resposta vazia não apaga cache bom.

### IPCA

```json
{
  "points": [
    {
      "date": "2026-05-01",
      "month": "2026-05",
      "monthlyPercent": 0.26,
      "accumulatedPercent": 4.12
    }
  ],
  "series": [],
  "items": []
}
```

Regra de UI:

- usar `points/series/items`, em ordem cronológica;
- preferir `accumulatedPercent` do Proxy;
- se ausente, APK calcula acumulado composto;
- fallback local só entra quando o Proxy não retorna série.

### Histórico patrimonial

```json
{
  "points": [],
  "history": [],
  "summary": {
    "investedValue": 0,
    "currentValue": 0,
    "unrealizedPnLPercent": 0
  }
}
```

Regra de UI:

- não contar ativo antes de `firstPurchaseAt`;
- aceitar aliases de retorno;
- usar cache/local se o Proxy passar do deadline.

### Alocação

```json
{
  "allocation": {
    "byTicker": [],
    "byType": [],
    "bySector": [],
    "byAccount": [],
    "byIssuer": [],
    "byIndexer": [],
    "byObjective": []
  },
  "partial": false,
  "diagnostics": {}
}
```

Regra de UI:

- se `partial=true`, preservar cálculo local/cache;
- nunca bloquear tela de gráficos por alocação remota lenta.

## Validações executadas

### Proxy

`npm run check` executado com sucesso em 295 arquivos JS.

Log salvo em:

```text
docs/PROXY_CHECK_FLOW_PERFORMANCE_v21.12.83.log
```

### APK

Foi feita tentativa de build com Gradle. O ambiente não conseguiu baixar o Gradle por bloqueio/DNS para `services.gradle.org`.

Log salvo em:

```text
docs/APK_BUILD_ATTEMPT_FLOW_PERFORMANCE_v2.0.55.log
```

O erro observado foi de rede do ambiente, não uma falha de código Kotlin/Android:

```text
java.net.UnknownHostException: services.gradle.org
```

## Resultado esperado

- Abertura das telas de gráficos/proventos com cache/local primeiro.
- Menos chamadas duplicadas e menos espera em cascata.
- IPCA+ com série mais consistente.
- Histórico patrimonial mais correto para carteiras com compras ao longo do tempo.
- Proventos passados baseados em elegibilidade da carteira.
- Agenda baseada em futuros e preservando cache quando a fonte externa falha.
- Alocação com fallback parcial em vez de travar fluxo.
- Compatibilidade preservada com rotas antigas e estrutura atual do projeto.

## Limitações honestas

- O APK Vesto foi inspecionado via assets públicos extraídos, não por decompilação Java/Kotlin completa.
- O build Android completo não pôde ser concluído no sandbox porque o Gradle wrapper depende de download externo bloqueado.
- Não foram feitos testes reais contra Investidor10/BCB com rede externa no runtime do pacote; a correção foi feita pelo contrato e validação estática do Proxy.

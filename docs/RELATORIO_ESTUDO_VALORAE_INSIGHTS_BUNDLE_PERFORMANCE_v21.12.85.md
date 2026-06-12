# Relatório técnico — VALORAE APK v2.0.57 + VALORAE Proxy v21.12.85

## Escopo

Nova auditoria profunda do fluxo referências externas aplicada ao VALORAE com foco em:

- Evolução de proventos;
- Agenda de dividendos;
- Equilíbrio de Carteira;
- Rentabilidade vs IPCA+;
- Rankings;
- Redução de chamadas duplicadas entre APK e Proxy;
- Montagem mais rápida e resiliente das páginas de dados.

A árvore do projeto foi preservada. Não houve renomeação de raiz, pacote Android, nomes principais do projeto, estrutura Gradle ou estrutura do Proxy.

---

## 1. Diagnóstico comparativo referências externas

### 1.1 motor externo de referência

O motor externo de referência usa três ideias que continuam sendo muito relevantes para o VALORAE:

1. **Batch real:** agrupa trabalho semelhante em uma única execução.
2. **In-flight/dedupe:** chamadas iguais em andamento são reaproveitadas.
3. **Circuit/cache:** evita insistir em fonte externa quando ela está lenta ou falhando.

No VALORAE, antes desta rodada, o APK podia disparar várias rotas quase ao mesmo tempo:

```text
/portfolio/analyze
/portfolio/history
/market/ipca
/dividends/batch
/market/rankings
```

Isso aumentava latência, concorrência no Proxy, risco de timeout e chance de uma página montar com blocos faltando.

### 1.2 APK externo de referência

O APK externo de referência reforça o padrão:

```text
1. Mostra dados locais/cache primeiro
2. Busca dados novos em segundo plano
3. Não apaga dados bons se a rede falhar
4. Atualiza blocos conforme chegam
```

Essa lógica foi aplicada de forma mais explícita no VALORAE: o APK agora tenta um bundle agregado e mantém os endpoints legados como fallback.

---

## 2. Principal mudança arquitetural

### 2.1 Nova rota agregada no Proxy

Foi criada a rota:

```text
/api/v1/portfolio/insights-bundle
```

Ela entrega em uma chamada:

```json
{
  "analysis": {},
  "portfolioHistory": [],
  "ipcaSeries": [],
  "dividends": {
    "officialEvents": [],
    "portfolioReceived": [],
    "portfolioUpcoming": []
  },
  "portfolioRanking": {},
  "blockStatus": {},
  "counts": {},
  "partial": false
}
```

### 2.2 Efeito no APK

O APK passa a tentar primeiro:

```text
B3NetworkService.fetchPortfolioInsightsBundle(...)
```

Se algum bloco vier vazio/parcial, o APK chama os endpoints antigos apenas para o bloco faltante.

Fluxo novo:

```text
APK carrega cálculo local
↓
APK tenta /portfolio/insights-bundle
↓
Se bundle completo: monta páginas com uma resposta
↓
Se bundle parcial: chama rotas antigas somente para lacunas
↓
Nunca apaga dados bons/cache por resposta vazia
```

---

## 3. Melhorias por página

## 3.1 Evolução de proventos

### Problema observado

A tela podia depender de eventos misturados entre:

- histórico oficial do ativo;
- provento recebido pela carteira;
- provento futuro;
- fallback antigo.

Isso causava risco de gráfico vazio quando a chamada rápida retornava parcial.

### Correção aplicada

O bundle entrega explicitamente:

```text
officialDividendEvents
portfolioReceivedDividends
portfolioUpcomingDividends
assetDividendHistory
```

O APK usa esses blocos antes de recorrer ao parser antigo.

### Resultado esperado

- Evolução de proventos usa recebidos elegíveis.
- Histórico oficial fica separado.
- Dados em cache são preservados.
- Menos chamadas ao Proxy para montar o mesmo gráfico.

---

## 3.2 Agenda de dividendos

### Problema observado

A Agenda podia ficar vazia quando a fonte externa demorava ou quando o endpoint antigo retornava parcial.

### Correção aplicada

O bundle chama a agenda no Proxy com deadline próprio e retorna:

```text
portfolioUpcoming
portfolioUpcomingDividends
officialEvents
assetHistory
```

Se a agenda não completar, o APK mantém cache e usa fallback antigo.

### Resultado esperado

- A Agenda abre mais rápido.
- Próximos dividendos são calculados por posição atual.
- Resposta parcial não derruba a UI.

---

## 3.3 Equilíbrio de Carteira

### Problema observado

A tela dependia de `portfolio/analyze` isolado. Em rede lenta, a UI caía para heurísticas locais.

### Correção aplicada

O bundle inclui `analysis`/`portfolioAnalysis` com:

- alocação por classe;
- alocação por setor;
- concentração;
- risco;
- warnings;
- plano de ação;
- ranking de posições;
- rebalance actions.

### Resultado esperado

- O Equilíbrio de Carteira recebe dados remotos junto com os outros blocos.
- O cálculo local continua sendo mostrado primeiro.
- O Proxy reduz fan-out e melhora tempo de montagem.

---

## 3.4 Rentabilidade vs IPCA+

### Problema observado

Histórico da carteira e IPCA vinham de rotas separadas, com risco de desalinhamento temporal e atraso.

### Correção aplicada

O bundle entrega:

```text
portfolioHistory
ipcaSeries
```

O APK normaliza as séries pela idade real da carteira e mantém fallback local caso o IPCA não chegue.

Também foi reforçada a rota `/market/ipca` com:

- `timeoutMs` respeitado;
- `routeDeadlineMs` respeitado;
- resposta parcial segura;
- cache-control stale-friendly.

### Resultado esperado

- Menor chance de gráfico de rentabilidade vs IPCA+ vazio.
- Melhor alinhamento entre série da carteira e IPCA.
- O APK preserva fallback se Banco Central/SGS estiver lento.

---

## 3.5 Rankings

### Problema observado

Rankings eram chamados separadamente e em modo não-forçado podiam não chegar para a tela de carteira.

### Correção aplicada

O bundle inclui ranking da carteira com base nos tickers do usuário:

```text
portfolioRanking
rankings.portfolio
```

Em sincronização profunda, o APK ainda pode chamar `fetchPortfolioRankings` como fallback.

### Resultado esperado

- Rankings aparecem com mais frequência sem nova chamada isolada.
- A tela preserva o último ranking quando o Proxy retorna parcial.
- Reduz concorrência e chamadas duplicadas.

---

## 4. Melhorias no Proxy

### Arquivos alterados

```text
routes/_router.js
routes/portfolio/insights-bundle.js
routes/market/ipca.js
package.json
metadata.json
```

### O que mudou

1. Criada rota `/api/v1/portfolio/insights-bundle`.
2. Adicionado coalescing via `coalesce(...)` para chamadas de carteira equivalentes.
3. Cada bloco tem deadline independente:
   - análise;
   - histórico;
   - IPCA;
   - dividendos;
   - rankings.
4. A resposta informa `blockStatus`, `counts`, `partial`, `warnings` e `sourceStatus`.
5. A rota `/market/ipca` agora respeita `timeoutMs` e `routeDeadlineMs`.
6. A rota agregada usa os mesmos contratos antigos como aliases, para compatibilidade Android.

---

## 5. Melhorias no APK

### Arquivos alterados

```text
app/src/main/java/com/example/network/B3NetworkService.kt
app/src/main/java/com/example/viewmodel/PortfolioViewModel.kt
app/build.gradle.kts
metadata.json
```

### O que mudou

1. Adicionado `PortfolioInsightsBundle`.
2. Adicionado `B3NetworkService.fetchPortfolioInsightsBundle(...)`.
3. Adicionado parser de:
   - análise de carteira;
   - histórico patrimonial;
   - IPCA;
   - proventos;
   - ranking.
4. `refreshPortfolioAnalytics(...)` agora tenta o bundle primeiro.
5. Endpoints antigos continuam como fallback por bloco.
6. Dados locais continuam sendo montados antes da rede.
7. Versão Android atualizada para `2.0.57`.

---

## 6. Contrato APK ↔ Proxy

### Caminho preferencial

```text
APK
↓
/api/v1/portfolio/insights-bundle
↓
analysis + history + ipca + dividends + rankings
↓
PortfolioAnalyticsState
↓
Telas de Proventos, Agenda, Equilíbrio, IPCA+ e Rankings
```

### Fallbacks preservados

```text
/api/v1/portfolio/analyze
/api/v1/portfolio/history
/api/v1/market/ipca
/api/v1/dividends/batch
/api/v1/market/rankings
```

---

## 7. Validação executada

### Proxy

Comando:

```text
npm run check
```

Resultado:

```text
Checked 296 JS files
```

Também foi feito teste local da rota `/portfolio/insights-bundle` para validar carregamento/importação e resposta de erro controlado quando `positions` está vazio.

### APK

Comando tentado:

```text
./gradlew test --no-daemon
```

Resultado do ambiente:

```text
UnknownHostException: services.gradle.org
```

O sandbox não conseguiu baixar a distribuição Gradle. O erro foi de rede/DNS do ambiente, não uma falha confirmada do código. O log foi salvo em:

```text
app/docs/APK_BUILD_ATTEMPT_INSIGHTS_BUNDLE_v2.0.57.log
```

---

## 8. Conclusão

A maior otimização desta rodada foi trocar o padrão de múltiplas chamadas paralelas soltas por um **bundle agregado, coalescido e stale-first**.

Antes:

```text
APK dispara várias rotas
↓
Cada rota pode atrasar ou falhar separadamente
↓
Telas montam com blocos ausentes
```

Depois:

```text
APK calcula local
↓
APK tenta bundle único
↓
Proxy executa blocos com deadlines independentes
↓
APK usa bundle completo ou fallback por bloco
↓
Dados bons/cache são preservados
```

Essa arquitetura melhora desempenho percebido, reduz pressão sobre o Proxy, torna a montagem das páginas mais previsível e mantém compatibilidade total com rotas antigas.

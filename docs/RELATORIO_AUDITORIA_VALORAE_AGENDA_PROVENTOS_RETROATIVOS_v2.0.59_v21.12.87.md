# Relatório de auditoria — VALORAE agenda, evolução de proventos, performance e limpeza

**Entrega:** APK VALORAE `v2.0.59` + VALORAE Proxy `v21.12.87`  
**Foco:** Agenda de dividendos, evolução de proventos retroativa, integração APK ↔ Proxy, performance e limpeza de código.  
**Base de trabalho:** versões imediatamente anteriores `APK v2.0.58` e `Proxy v21.12.86`.

---

## 1. Referência comparativa referências externas

A nova revisão manteve como referência os pontos fortes observados no referências externas:

1. **Batch/coalescing:** evitar chamadas duplicadas e agrupar tickers por janela.
2. **Cache/stale-first:** mostrar o que já existe e atualizar em segundo plano.
3. **Agenda orientada pela tela:** quando a tela é agenda, futuros vêm antes; quando a tela é evolução, histórico suficiente precisa estar disponível.
4. **Proventos conhecidos:** eventos oficiais precisam ser preservados e reaproveitados, não reconstruídos como previsão local.
5. **Elegibilidade por Data Com:** para recebido retroativo, a data que decide direito é `dateCom`/record date; `paymentDate` serve para classificar passado/futuro e ordenar pagamento.

---

## 2. Diagnóstico encontrado

### 2.1 Agenda de dividendos incompleta

A agenda estava mais rápida, mas ainda podia perder pagamentos futuros porque:

- o modo rápido do APK/Proxy usava janelas pequenas demais;
- a agenda intercalava futuro e histórico, podendo gastar deadline com meses passados antes de concluir futuros;
- algumas renderizações do Investidor10 trazem pagamento como `Provisionado`, `A confirmar` ou `Sem data`, e um fallback do parser ainda esperava uma data explícita;
- carteiras acima de 30 tickers/posições ficavam excessivamente truncadas.

### 2.2 Evolução de proventos retroativa incompleta

O problema mais importante estava na elegibilidade:

```text
Antes: paymentDate || dateCom
Depois: dateCom || recordDate || dataCom || paymentDate
```

Para **proventos recebidos**, usar `paymentDate` primeiro é errado porque o investidor ganha direito na `Data Com`, não no dia em que o dinheiro cai. Isso podia excluir eventos em que o ativo foi comprado antes da `Data Com`, mas pago depois.

Além disso, o APK enviava para o Proxy somente posições atuais. A partir desta rodada, a análise continua usando posições atuais, mas o fluxo de proventos usa uma lista própria derivada do histórico de transações, permitindo buscar eventos oficiais de ativos que aparecem no histórico da carteira.

---

## 3. Correções aplicadas no Proxy `v21.12.87`

### Agenda e parser

- `DEFAULT_FUTURE_MONTHS`: `18` → `24`.
- `DEFAULT_HISTORY_MONTHS`: `36` → `48`.
- `buildDividendAgendaUrls` agora aceita prioridade:
  - `futureFirst` / `upcoming-first` para Agenda;
  - `historyFirst` / `retro` para histórico profundo.
- Ordem da agenda futura:
  1. mês atual;
  2. próximos meses;
  3. histórico recente;
  4. histórico profundo.
- Parser de layout compacto agora aceita pagamento textual:
  - `Provisionado`;
  - `A confirmar`;
  - `Sem data`.

### Batch e endpoints de proventos

- `/api/v1/dividends/batch` ampliado para até **45 tickers**.
- Janelas padrão:
  - rápido: `historyMonths=24`, `futureMonths=18`;
  - profundo: `historyMonths=48`, `futureMonths=24`.
- Deadline do modo mobile ampliado sem voltar ao comportamento lento anterior.
- `splitByPortfolio` corrigido:
  - elegibilidade usa `dateCom` primeiro;
  - classificação passado/futuro usa `paymentDate`.
- Cada evento calculado passa a carregar `eligibilityDate`, facilitando auditoria no APK.

### Insights bundle

- `/api/v1/portfolio/insights-bundle` agora aceita:
  - `dividendPositions`;
  - `dividendTickers`.
- A análise de carteira continua baseada em posições atuais, mas a agenda/evolução usam posições/tickers próprios de proventos.
- `INSIGHTS_BUNDLE_VERSION`: `21.12.85` → `21.12.87`.

### Rotas legadas preservadas

Foram mantidas e reforçadas:

- `/api/v1/portfolio/next-dividends`;
- `/api/v1/portfolio/dividends`;
- `/api/v1/dividends/batch`.

Carteiras acima do limite agora geram `warnings`, em vez de derrubar a resposta com erro rígido.

---

## 4. Correções aplicadas no APK `v2.0.59`

### Agenda de dividendos

- O APK agora pede explicitamente:
  - `futureFirst=true`;
  - `priority=upcoming-first`;
  - `futureMonths=18` no modo rápido;
  - `futureMonths=24` no modo profundo;
  - `agendaConcurrency=5`.
- Timeouts foram ajustados para preservar velocidade, mas permitir que a agenda futura complete mais meses.
- Limite remoto ampliado para **45 posições**.
- Buckets balanceados:
  - ações/units: `22`;
  - FIIs: `23`.

### Evolução de proventos

- `fetchPortfolioInsightsBundle` ganhou `dividendSourcePositions` separado das posições de análise.
- O `PortfolioViewModel` agora cria `dividendProxyPositionsForTransactions`, derivado das transações de compra/venda.
- Isso permite buscar eventos oficiais de proventos por histórico de carteira sem contaminar:
  - equilíbrio de carteira;
  - alocação;
  - análise de risco;
  - rentabilidade atual.
- O cálculo local continua saneando os eventos com `sharesOwnedAt(...)`, que calcula a quantidade efetiva na data de elegibilidade.

### Limpeza

Removidos arquivos temporários de raiz do APK:

- `docs_TMP`;
- `temp.gradle`;
- `test_out.txt`;
- `test_out2.txt`.

Também foram atualizados:

- `metadata.json`;
- `update.json`;
- `version.json`;
- `app/build.gradle.kts`;
- manifesto/monitor/service worker do Proxy.

---

## 5. Compatibilidade preservada

Não foram renomeados:

- raiz do projeto;
- pacote Android;
- `applicationId`;
- namespace;
- rotas antigas;
- estrutura esperada pelo Google AI Studio.

As novas capacidades são complementares e mantêm fallback para os endpoints anteriores.

---

## 6. Validação executada

### Proxy

```text
npm run check: 297 arquivos JS verificados
npm test: 93 arquivos executados; falhas=0
npm run build: Build OK para Vercel
verificação estática v21.12.87: OK
```

Logs incluídos:

```text
docs/PROXY_CHECK_AGENDA_PROVENTOS_v21.12.87.log
docs/PROXY_TEST_AGENDA_PROVENTOS_v21.12.87.log
docs/PROXY_BUILD_AGENDA_PROVENTOS_v21.12.87.log
docs/PROXY_STATIC_AGENDA_PROVENTOS_v21.12.87.log
```

### APK

```text
verificação estática v2.0.59: OK
```

A tentativa de `./gradlew test --no-daemon` continuou bloqueada pelo ambiente por DNS/rede:

```text
UnknownHostException: services.gradle.org
```

O log foi salvo em:

```text
app/docs/APK_BUILD_ATTEMPT_AGENDA_PROVENTOS_v2.0.59.log
```

---

## 7. Estatísticas de linhas no estilo Codex

### Alterações de código/estrutura, sem contar logs gerados

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 10 | +145 | -167 |
| Proxy | 13 | +186 | -86 |
| Total | 23 | +331 | -253 |

### Alterações totais incluindo logs de validação

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 12 | +178 | -167 |
| Proxy | 17 | +403 | -86 |
| Total | 29 | +581 | -253 |

### Arquivos de código/estrutura alterados no APK

| Arquivo | + | - |
|---|---:|---:|
| `app/build.gradle.kts` | +2 | -2 |
| `app/src/main/java/com/example/network/B3NetworkService.kt` | +37 | -25 |
| `app/src/main/java/com/example/viewmodel/PortfolioViewModel.kt` | +45 | -6 |
| `metadata.json` | +17 | -13 |
| `scripts/verify_valorae_agenda_proventos_v2059.py` | +32 | -0 |
| `temp.gradle` | +0 | -5 |
| `test_out.txt` | +0 | -60 |
| `test_out2.txt` | +0 | -44 |
| `update.json` | +6 | -6 |
| `version.json` | +6 | -6 |

### Arquivos de código/estrutura alterados no Proxy

| Arquivo | + | - |
|---|---:|---:|
| `lib/market/investidor10-dividend-agenda.js` | +25 | -8 |
| `lib/release/current.js` | +4 | -4 |
| `metadata.json` | +9 | -5 |
| `package.json` | +2 | -2 |
| `public/index.html` | +8 | -8 |
| `public/manifest.webmanifest` | +2 | -2 |
| `public/server.html` | +8 | -8 |
| `public/service-worker.js` | +2 | -2 |
| `routes/dividends/batch.js` | +26 | -13 |
| `routes/portfolio/dividends.js` | +9 | -7 |
| `routes/portfolio/insights-bundle.js` | +41 | -17 |
| `routes/portfolio/next-dividends.js` | +17 | -10 |
| `scripts/verify-dividend-agenda-retroactive-v21-12-87.mjs` | +33 | -0 |

---

## 8. Conclusão

A rodada corrigiu os dois pontos funcionais reportados:

1. **Agenda de dividendos:** agora busca futuro primeiro, com janela maior e parser mais tolerante.
2. **Evolução de proventos:** agora usa `Data Com` como data de elegibilidade e separa posições históricas de proventos das posições atuais de análise.

Também foi feita limpeza leve no APK, atualização de versionamento e validação completa do Proxy.

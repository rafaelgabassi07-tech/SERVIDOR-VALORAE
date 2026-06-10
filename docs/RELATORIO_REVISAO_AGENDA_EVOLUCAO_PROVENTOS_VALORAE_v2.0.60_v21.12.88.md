# Relatório técnico — Revisão final da Agenda de Dividendos e Evolução de Proventos

**Entrega:** APK VALORAE `v2.0.60` + VALORAE Proxy `v21.12.88`  
**Foco:** corrigir a arquitetura de dados de proventos para que Agenda e Evolução bebam da mesma fonte oficial, mas cada tela aplique sua própria regra de carteira.  
**Princípio adotado:** Proxy busca e preserva o universo oficial; APK calcula elegibilidade e montagem por tela.

---

## 1. Diagnóstico principal

A dificuldade encontrada não era apenas velocidade. O problema estava na separação semântica entre as datas:

- **Data Com / record date:** define se a carteira tinha direito ao provento.
- **Data de pagamento:** define quando o dinheiro entra e, portanto, se o evento pertence à Evolução de Proventos ou à Agenda.

Na versão anterior, algumas partes do app ainda podiam usar `Data Com` como fallback de `paymentDate`. Isso fazia com que eventos anunciados/provisionados, sem pagamento confirmado, entrassem em fluxos de recebimento ou fossem ordenados de forma ambígua.

---

## 2. Arquitetura corrigida

### Fonte única

O Proxy agora expõe os eventos oficiais amplos em blocos explícitos:

```text
officialEvents               = todos os eventos oficiais conhecidos
officialPaidEvents           = eventos oficiais com pagamento passado confirmado
officialFutureEvents         = eventos oficiais com pagamento futuro confirmado
officialAnnouncedEvents      = eventos anunciados/provisionados sem pagamento confirmado
officialUpcomingEvents       = futuros confirmados + anunciados/provisionados
allOfficialFuturePayments    = alias compatível para a Agenda
```

### Filtragem no APK

O APK passa a tratar cada tela assim:

```text
Agenda de Dividendos:
- paymentDate futura confirmada; ou
- evento anunciado/provisionado sem paymentDate;
- carteira precisa ser elegível pela Data Com.

Evolução de Proventos:
- exige paymentDate confirmada no passado;
- exige quantidade > 0 na Data Com;
- não usa Data Com como data de recebimento.
```

---

## 3. Correções aplicadas no Proxy `v21.12.88`

### 3.1 `/api/v1/dividends/batch`

- Adicionado `splitOfficialByPaymentStatus`.
- Adicionados blocos oficiais futuros/recebidos/anunciados.
- `portfolioReceived` agora só recebe evento se existir `paymentDate` passada.
- Eventos sem `paymentDate` não viram recebidos; permanecem em `portfolioUpcoming`.
- Status de blocos da carteira agora é explícito:
  - `Recebido` para recebidos;
  - `Previsto` ou `Anunciado/Provisionado` para agenda.

### 3.2 `/api/v1/portfolio/insights-bundle`

- Mesmo contrato de blocos oficiais aplicado dentro do bundle.
- `counts` agora inclui `officialFutureEvents` e `officialAnnouncedEvents`.
- O bundle preserva compatibilidade antiga:
  - `portfolioReceivedDividends`;
  - `portfolioUpcomingDividends`;
  - `dividendEvents`;
  - `officialEvents`.

### 3.3 Limpeza e consistência de versão

- Release pública atualizada para `21.12.88-agenda-evolution-logic-fix`.
- Monitor, service worker, manifesto e metadados mantidos consistentes.
- Adicionado script de verificação:

```text
scripts/verify-dividend-agenda-evolution-v21-12-88.mjs
```

---

## 4. Correções aplicadas no APK `v2.0.60`

### 4.1 `ChartsScreen.kt`

- Removido retorno bruto indevido em `agendaDividendEvents`.
- Agenda agora filtra corretamente:
  - pagamento futuro confirmado;
  - provisionado/anunciado sem pagamento;
  - elegibilidade pela carteira.
- Evolução agora usa `eventPaymentMillis(event)`, não `eventRelevantMillis(event)`.
- `isPaidDividendEvent` exige `paymentDate` confirmada no passado.
- `eligibleDividendAmount` corrigido:
  - se existe Data Com, usa quantidade na Data Com;
  - se o usuário comprou depois da Data Com, não recebe o pagamento futuro;
  - só usa quantidade atual para evento ainda elegível/futuro.
- Ranking/top ativos por proventos agora considera apenas eventos pagos.

### 4.2 `DashboardScreen.kt`

- Mesma correção de Data Com x paymentDate.
- KPIs de proventos no Dashboard não contam mais eventos só por Data Com passada.

### 4.3 `PortfolioViewModel.kt`

- `isReceivedDividendEvent` passou a exigir `paymentDate` passada.
- `splitDividendBlocksForState` não trata evento sem pagamento como recebido.
- Eventos provisionados ficam no bloco de Agenda.

### 4.4 `B3NetworkService.kt`

- Parser agora lê os novos blocos:
  - `officialPaidEvents`;
  - `officialFutureEvents`;
  - `officialAnnouncedEvents`;
  - `officialUpcomingEvents`;
  - `allOfficialFuturePayments`.
- O bundle usa `dividendPositions` no parse/cache de dividendos, preservando ativos que já foram vendidos mas ainda precisam aparecer no histórico retroativo.

---

## 5. Resultado esperado por tela

### Agenda de Dividendos

Agora deve mostrar:

- pagamentos futuros confirmados;
- eventos provisionados/anunciados sem pagamento;
- pagamentos futuros cuja Data Com já passou, desde que o usuário tivesse posição na Data Com.

Não deve mostrar:

- pagamentos já recebidos;
- pagamento futuro se o usuário comprou depois da Data Com;
- evento antigo sem pagamento confirmado fora da janela de anúncio.

### Evolução de Proventos

Agora deve mostrar:

- eventos pagos com `paymentDate` no passado;
- valores calculados com quantidade na Data Com;
- ativos vendidos depois, desde que a carteira tivesse posição na Data Com.

Não deve mostrar:

- evento sem data de pagamento;
- evento só anunciado;
- compra posterior à Data Com;
- projeção local como se fosse recebido.

---

## 6. Validação executada

### Proxy

```text
npm run check: 297 arquivos JS verificados
npm test: 93 arquivos executados; falhas=0
npm run build: Build OK para Vercel
npm run smoke: Smoke OK
verificação estática v21.12.88: OK
```

Logs:

```text
docs/PROXY_CHECK_AGENDA_EVOLUTION_v21.12.88.log
docs/PROXY_TEST_AGENDA_EVOLUTION_v21.12.88.log
docs/PROXY_BUILD_AGENDA_EVOLUTION_v21.12.88.log
docs/PROXY_SMOKE_AGENDA_EVOLUTION_v21.12.88.log
docs/PROXY_STATIC_AGENDA_EVOLUTION_v21.12.88.log
```

### APK

```text
verificação estática v2.0.60: OK
```

A tentativa de `./gradlew test --no-daemon` continuou bloqueada no sandbox por DNS/rede ao baixar Gradle:

```text
UnknownHostException: services.gradle.org
```

Log:

```text
app/docs/APK_BUILD_ATTEMPT_AGENDA_EVOLUTION_v2.0.60.log
```

---

## 7. Linhas adicionadas/removidas

Contagem sem logs gerados automaticamente.

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 9 | +247 | -95 |
| Proxy | 13 | +191 | -65 |
| Total | 22 | +438 | -160 |

Arquivos de detalhe:

```text
APK: app/docs/ARQUIVOS_ALTERADOS_AGENDA_EVOLUTION_v2.0.60.txt
Proxy: docs/ARQUIVOS_ALTERADOS_AGENDA_EVOLUTION_v21.12.88.txt
JSON: CHANGE_STATS_v2.0.60_v21.12.88.json
```

---

## 8. Conclusão

A lógica final fica assim:

```text
Proxy busca tudo que é oficial
↓
Proxy separa blocos oficiais por status de pagamento
↓
APK usa Data Com para elegibilidade
↓
APK usa paymentDate para decidir Agenda x Evolução
↓
Agenda e Evolução usam a mesma fonte, mas não misturam conceitos
```

Essa é a arquitetura mais segura para carteira: a fonte de dados é única, mas a interpretação pertence ao APK, porque apenas o APK tem o histórico completo de transações do usuário.

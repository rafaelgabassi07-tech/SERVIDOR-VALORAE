# Relatório técnico — Reavaliação final de Agenda de Dividendos e Evolução de Proventos

**APK:** VALORAE v2.0.61  
**Proxy:** VALORAE Proxy v21.12.89  
**Foco:** validar e corrigir a lógica financeira, o fluxo de dados APK ↔ Proxy e os parsers que alimentam as telas **Agenda de Dividendos** e **Evolução de Proventos**.

---

## 1. Conclusão executiva

A arquitetura correta foi fixada da seguinte forma:

```text
Proxy = fonte ampla de eventos oficiais e captura externa
APK = motor de elegibilidade da carteira e decisão de tela
```

Agenda e Evolução passam a beber da mesma base oficial, mas não usam a mesma regra visual:

```text
Data Com / recordDate = data que define o direito ao provento
Data Ex = primeiro dia sem direito; se só ela existir, Data Com é o dia útil anterior
paymentDate / Data de Pagamento = data que define Agenda ou Evolução
```

Com isso:

- **Agenda de Dividendos** mostra pagamento futuro confirmado ou evento anunciado/provisionado ainda sem pagamento, desde que o usuário tenha direito pela Data Com.
- **Evolução de Proventos** só considera pagamento com `paymentDate` confirmada no passado e elegibilidade pela Data Com.
- Evento sem `paymentDate` nunca entra como recebido.
- `exDate` não é mais tratada diretamente como Data Com.
- `status` do pagamento foi separado de `dividendType`/tipo do provento.

---

## 2. Pesquisa de regra financeira usada

### 2.1 Data Ex e direito ao provento

A regra de mercado aplicada é que a negociação a partir da **Data Ex** ocorre sem direito ao provento anunciado. Portanto, para quem compra a partir da Data Ex, o evento não deve ser considerado elegível. Quando a fonte traz apenas Data Ex, o sistema passa a inferir a Data Com como o dia útil anterior.

### 2.2 Agenda de dividendos

A agenda é uma lista/calendário de datas de pagamento e valores provisionados/confirmados. Ela serve para acompanhar pagamentos futuros e eventos anunciados, não para afirmar que o pagamento já foi recebido.

### 2.3 Evolução de proventos

A evolução deve representar proventos efetivamente pagos/recebíveis no histórico. Portanto, exige Data de Pagamento confirmada no passado e elegibilidade na Data Com.

---

## 3. Problemas encontrados nesta reavaliação

### 3.1 `exDate` podia contaminar Data Com

Alguns payloads externos usam `exDate`, `dataEx` ou `exDividendDate`. Antes, havia risco de esses campos serem tratados como se fossem a própria Data Com.

**Correção:**

- `dateCom`, `dataCom`, `comDate`, `recordDate`, `dataBase`, `baseDate` são tratados como Data Com explícita.
- `exDate`, `dataEx`, `exDividendDate` são preservados separadamente.
- Se não houver Data Com e houver somente Data Ex, o sistema calcula a Data Com como dia útil anterior.

### 3.2 `date`/`data` genéricos eram ambíguos

Campos genéricos como `date` e `data` podiam representar Data Com, Data de Pagamento ou apenas data de card.

**Correção:**

- `date/data` só viram `paymentDate` quando há outro sinal forte de pagamento confirmado.
- Sem sinal de pagamento, `date/data` entram como data genérica de elegibilidade, não como recebimento.

### 3.3 Tipo do provento se misturava com status

`Dividendos`, `JCP`, `Rendimento` e `Amortização` são tipo do provento. `Recebido`, `Previsto`, `Provisionado` e `Anunciado` são status.

**Correção:**

- Novo campo preservado no contrato: `dividendType`.
- `status` passa a representar situação do pagamento/evento.
- O APK serializa e restaura `dividendType`, `exDate` e `eligibilityDateSource` no snapshot.

### 3.4 Parser do Investidor10 em HTML compacto podia cruzar cards

Foi reproduzido um caso crítico:

```text
FISC11 ... R$ 0,62 FATN11 ... R$ 0,80
```

O parser poderia atribuir o valor de um card ao ticker seguinte, ou confundir provento provisionado com o próximo pagamento histórico.

**Correção:**

- O parser segmenta por ticker.
- O layout `valor antes do ticker` continua suportado.
- O layout `ticker antes do valor` foi protegido contra vazamento de valor entre cards.
- Eventos com `Pgto Provisionado` seguidos por outra data antes do próximo `R$` não roubam o pagamento do próximo card.

---

## 4. Fluxo final validado

### 4.1 Proxy

O Proxy busca e normaliza o universo oficial:

```text
officialEvents
officialPaidEvents
officialFutureEvents
officialAnnouncedEvents
officialUpcomingEvents
allOfficialFuturePayments
portfolioReceived
portfolioUpcoming
```

### 4.2 APK

O APK decide a tela com base na carteira:

```text
quantityAtDate(Data Com) > 0  => usuário tinha direito
paymentDate < hoje            => Evolução de Proventos
paymentDate >= hoje           => Agenda de Dividendos
paymentDate ausente + anunciado/provisionado => Agenda, não Evolução
```

---

## 5. Arquivos principais alterados

### APK

- `app/src/main/java/com/example/network/B3NetworkService.kt`
- `app/src/main/java/com/example/viewmodel/PortfolioViewModel.kt`
- `app/build.gradle.kts`
- `metadata.json`
- `update.json`
- `version.json`
- `scripts/verify_valorae_agenda_evolution_v2061.py`

### Proxy

- `lib/market/investidor10-dividend-agenda.js`
- `lib/Valorae-engine.js`
- `routes/dividends/batch.js`
- `routes/portfolio/insights-bundle.js`
- `routes/portfolio/dividends.js`
- `routes/portfolio/next-dividends.js`
- `lib/release/current.js`
- `public/service-worker.js`
- `public/manifest.webmanifest`
- `metadata.json`
- `package.json`
- scripts de verificação v21.12.89

---

## 6. Validações executadas

### Proxy

```text
npm run check
Resultado: Checked 298 JS files
```

```text
npm test
Resultado: 93 arquivos executados; falhas=0; lentos=nenhum
```

```text
npm run build
Resultado: Build OK para Vercel
```

```text
node scripts/verify-dividend-agenda-evolution-v21-12-89.js
Resultado: Dividend agenda/evolution v21.12.89 OK
```

### APK

```text
python3 scripts/verify_valorae_agenda_evolution_v2061.py
Resultado: VALORAE APK agenda/evolução v2.0.61 OK
```

Tentativa de Gradle:

```text
./gradlew test --no-daemon
Resultado: bloqueado no sandbox por UnknownHostException em services.gradle.org
```

O bloqueio foi de rede para baixar a distribuição Gradle, não uma falha confirmada de Kotlin/Android.

---

## 7. Cenários simulados cobertos

### Cenário 1 — Compra antes da Data Com e pagamento futuro

```text
PETR4
Compra: 30/06/2026
Data Com: 01/07/2026
Pagamento: 15/07/2026
Hoje: 10/06/2026
```

Resultado esperado e validado: entra na Agenda com quantidade da Data Com.

### Cenário 2 — Evento provisionado sem pagamento

```text
BBAS3
Data Com: 20/06/2026
Pgto: Provisionado
```

Resultado esperado e validado: entra na Agenda como anunciado/provisionado e não entra na Evolução.

### Cenário 3 — Pagamento histórico confirmado

```text
VALE3
Data Com: 15/03/2026
Pagamento: 10/04/2026
Hoje: 10/06/2026
```

Resultado esperado e validado: entra na Evolução.

### Cenário 4 — Compra depois da Data Com

```text
PETR4
Compra adicional: 02/07/2026
Data Com: 01/07/2026
```

Resultado esperado e validado: compra posterior não aumenta o direito ao provento.

---

## 8. Linhas adicionadas/removidas

Sem contar logs e relatórios gerados:

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 7 | +152 | -43 |
| Proxy | 16 | +303 | -80 |
| Total | 23 | +455 | -123 |

Contando logs e relatórios internos de validação:

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 11 | +208 | -59 |
| Proxy | 25 | +526 | -92 |
| Total | 36 | +734 | -151 |

---

## 9. Estado final

A lógica final ficou consistente:

```text
Agenda = futuro confirmado + anunciado/provisionado elegível
Evolução = pagamento passado confirmado + elegível na Data Com
Proxy = fonte oficial ampla
APK = filtro inteligente da carteira
```

Essa separação reduz falsos positivos, evita pagamentos sumirem por timeout e impede que eventos sem pagamento confirmado inflem a evolução histórica.

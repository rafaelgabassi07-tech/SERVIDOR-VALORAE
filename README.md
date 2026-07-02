# VALORAE Proxy — v167

Public version: 21.12.197
Patch: `21.12.197-analysis-quotes-liquidity-fallback-v167`

Refina /api/v1/quotes para reduzir campos vazios de P/VP, DY, cotação e liquidez nas subpáginas da Análise, extraindo liquidez do snapshot Fundamentus e estimando valor negociado via volume quando necessário.

## Principais mudanças
- Snapshot Fundamentus passa a mapear aliases adicionais de P/VP/PVPA, DY, cotação e liquidez média diária.
- Parser de FIIs e ações aceita colunas como Liq.2meses, Liquidez Média Diária, Liq. Diária e Volume Médio.
- Quotes do Yahoo preservam volume negociado e o contrato estima liquidez quando a fonte de fundamentos não entrega liquidez explícita.
- Mantida compatibilidade com assets, quotes, items e results do contrato do APK.

---

# VALORAE Proxy — v166

Public version: 21.12.196
Patch: `21.12.196-analysis-liquidity-quotes-v166`

Enriquece o contrato de notícias com hints de título, tópico, motivo e URL de abertura para notificações profissionais no APK.

# VALORAE Proxy — v164

Ajusta o contrato de quotes para suportar melhor o carregamento sob demanda de P/VP e DY nas subpáginas de categorias da Análise.

- Release: 21.12.194-notification-news-analysis-cards-v164
- Public version: 21.12.194
- Checkpoint: notification-news-analysis-cards-v164

---

# VALORAE Proxy — v163

Checkpoint: notification-permissions-refinement-v163.

## Principais mudanças
- `/api/v1/news` aceita até 96 símbolos por consulta.
- Consulta de carteira usa termos de evento relevante para reduzir ruído: fato relevante, comunicado ao mercado, CVM, proventos, resultado, rating, recompra e subscrição.
- Itens de notícias recebem `notificationCandidate`, `relevanceScore` e `relevanceSignals` para apoiar alertas acionáveis no APK.

## Versão pública
- 21.12.193

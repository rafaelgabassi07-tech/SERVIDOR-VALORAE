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

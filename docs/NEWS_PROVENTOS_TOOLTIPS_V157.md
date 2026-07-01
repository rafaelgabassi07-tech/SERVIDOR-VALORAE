# VALORAE Proxy v157 — Notícias, Proventos e Tooltips

Patch: `21.12.187-news-proventos-tooltips-v157`
Data: 2026-07-01

## Ajustes
- O endpoint de notícias passa a devolver a coleção final sempre ordenada por data de publicação decrescente.
- O payload inclui `sortedBy: publishedAt_desc`, `asOf` e política de frescor para o APK validar a leitura atualizada.
- O histórico de proventos normaliza pagamento, Data COM e competência mensal antes de montar os itens da Análise.
- Datas em formato mês/ano (`YYYY-MM`, `MM/YYYY`) são preservadas como competência, evitando linhas sem data.

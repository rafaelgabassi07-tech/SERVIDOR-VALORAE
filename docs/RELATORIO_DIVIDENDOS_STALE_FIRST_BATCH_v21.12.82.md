# VALORAE Proxy v21.12.82 — Dividendos stale-first e batch canônico

Alterações pontuais sem renomear o projeto:

- Criada rota `/api/v1/dividends/batch` para retornar `officialEvents`, `assetHistory`, `portfolioReceived`, `portfolioUpcoming`, `diagnostics`, `partial` e `cacheStatus`.
- Adicionado coalescing/in-flight para chamadas de agenda de dividendos.
- Agenda Investidor10 agora prioriza mês atual, próximos 3 meses, últimos 6 meses e próximos 12 meses antes de histórico profundo.
- Cache de agenda ganhou modo stale para retornar dados bons quando a fonte falha ou o deadline estoura.
- Units B3 terminadas em 11 continuam como ações/units e não são enviadas automaticamente como FII.
- SQL Supabase recebeu tabelas opcionais para eventos oficiais globais e vínculo por usuário.

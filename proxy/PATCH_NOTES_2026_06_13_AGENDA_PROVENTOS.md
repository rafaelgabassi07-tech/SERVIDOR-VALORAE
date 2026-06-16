# VALORAE Proxy — Agenda de Proventos para o APK

## Ajustes desta rodada

- Mantida a rota canônica `POST /api/v1/dividends/batch` para a agenda mobile.
- A rota direta `routes/dividends/batch.js` foi compatibilizada com o contrato consolidado `buildDividendsContract`.
- Preservada a integração anterior de ranking diário do Investidor10 em `/api/v1/market/rankings`.
- O contrato de proventos continua retornando blocos compatíveis com o APK: `portfolioUpcoming`, `portfolioUpcomingDividends`, `officialUpcomingEvents`, `received`, `upcoming`, `events` e `dividends`.

## Regra de agenda

O Proxy recebe `positions` do APK, calcula elegibilidade por data-com/data-base quando disponível e retorna como principal apenas os próximos pagamentos aplicáveis à carteira.

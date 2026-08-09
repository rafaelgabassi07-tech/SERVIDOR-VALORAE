# v162 — Radar de notícias para notificações da carteira

Data: 2026-07-01

## Ajustes

- `/api/v1/news` passa a aceitar até 48 símbolos por chamada, preservando compatibilidade com o APK.
- Fonte `lib/sources/news.js` amplia o limite interno de símbolos para evitar truncar carteiras maiores no radar de notícias.
- Mantida a janela `when:1d` e a ordenação por publicação recente.
- Sem alteração no contrato de resposta: o APK continua consumindo `items/news/articles`, `symbols`, `publishedAt`, `url`, `source` e `summary`.

## Objetivo

Reduzir o caso em que o Worker de notificações só monitora parte da carteira e deixa de disparar alerta quando uma notícia recente cita um ativo que ficou fora do primeiro lote.

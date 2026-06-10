# VALORAE Proxy

Proxy enxuto do ecossistema VALORAE. A entrada principal para o APK é:

```text
/api/v1/mobile/portfolio-sync
```

A versão `21.13.1` mantém o contrato mobile único, remove fan-out oculto do fluxo normal e preserva aliases leves apenas quando o APK precisa de compatibilidade direta.

## Rotas principais

- `GET /api/v1/health`
- `GET /api/v1/manifest`
- `POST /api/v1/mobile/portfolio-sync`
- `POST /api/v1/dividends/batch`
- `GET /api/v1/asset/history`
- `GET /api/v1/asset/dividends`
- `GET /server.html`

## Regras centrais

- O Proxy normaliza eventos oficiais e entrega contrato previsível.
- O APK calcula carteira, elegibilidade, Agenda e Evolução.
- Data Com ou Data Ex menos um pregão define direito ao provento.
- Data de pagamento define se o evento aparece em Agenda ou Evolução.

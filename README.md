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


## Proventos oficiais

O Proxy usa o Status Invest por ativo como fonte principal de proventos passados, anunciados e futuros, via `companytickerprovents`, e usa a agenda pública como complemento para calendário quando disponível. Não é necessário configurar variáveis de ambiente para isso funcionar.

Variáveis opcionais:

- `VALORAE_STATUSINVEST_ENABLED=0` desativa a busca no Status Invest.
- `VALORAE_STATUSINVEST_CHART_PROVENTS_TYPE=2` define o tipo do gráfico/consulta de proventos usado no Status Invest.
- `VALORAE_STATUSINVEST_TIMEOUT_MS=5500` define timeout da fonte Status Invest.
- `VALORAE_AGENDA_ENABLED=0` ou `VALORAE_INVESTIDOR10_AGENDA_ENABLED=0` desativa apenas o complemento de agenda pública.
- `VALORAE_AGENDA_MONTH_PAGES_ENABLED=0` desativa varredura de páginas mensais futuras do Investidor10.
- `VALORAE_AGENDA_MONTHS_AHEAD=18` define o horizonte de páginas mensais futuras.
- `VALORAE_IPCA_INVESTIDOR10_ENABLED=0` desativa o fallback real de IPCA pela tabela pública do Investidor10 quando o BCB estiver indisponível.
- `VALORAE_FETCH_RETRIES=1` controla retentativas curtas para Status Invest/Investidor10/BCB sem criar dados simulados.

As rotas que alimentam a Agenda de Dividendos e a Evolução de Proventos são `/api/v1/dividends/batch`, `/api/v1/portfolio/next-dividends`, `/api/v1/portfolio/events`, `/api/v1/asset/dividends` e `/api/v1/asset/next-dividend`.

# Valorae Proxy v20.8 — Scraper Gap Boost

Esta versão foca nas fraquezas do Valorae em comparação com o `Scraper (4).js`, mantendo o projeto compatível com GitHub/Vercel e sem dependências obrigatórias.

## Fraquezas tratadas

1. **Ranking por cesta fixa**  
   O Valorae agora tenta buscar ranking ao vivo do Investidor10 em `/api/market/rankings?source=auto`. Se a fonte bloquear ou não retornar dados, cai automaticamente para o ranking por comparação de fundamentos.

2. **Histórico sem calendário B3**  
   `/api/asset/history` agora aceita aliases `1A`, `5A` e `Tudo`, além de retornar metadados de calendário B3, sessão de mercado, último pregão e próximo pregão.

3. **Ausência de histórico consolidado de carteira**  
   Novo endpoint `/api/portfolio/history` calcula a série histórica do valor da carteira com base nas posições e cotações Yahoo Chart.

4. **Proventos futuros por carteira**  
   Novo endpoint `/api/portfolio/next-dividends` consolida próximo e último provento por ticker.

5. **Compatibilidade operacional com Scraper (4).js**  
   Novo endpoint `/api/compat/scraper4` aceita `POST { mode, payload }` para modos equivalentes: `rankings`, `indices`, `ipca`, `fundamentos`, `cotacao_historica`, `historico_portfolio`, `historico_12m`, `proventos_carteira` e `proximo_provento`.

## Endpoints novos

```text
/api/portfolio/history
/api/portfolio/next-dividends
/api/compat/scraper4
```

## Endpoints aprimorados

```text
/api/asset/history?ticker=PETR4&range=1A
/api/asset/history?ticker=PETR4&range=Tudo
/api/market/rankings?source=auto
/api/market/rankings?source=live
/api/market/rankings?source=compare
```

## Exemplos

```bash
curl "https://valorae-proxy.vercel.app/api/asset/history?ticker=PETR4&range=1A"
```

```bash
curl "https://valorae-proxy.vercel.app/api/portfolio/history?tickers=PETR4,GARE11&quantities=100,200&avgPrices=32,8.50&range=1Y"
```

```bash
curl -X POST "https://valorae-proxy.vercel.app/api/compat/scraper4" \
  -H "Content-Type: application/json" \
  -d '{"mode":"cotacao_historica","payload":{"ticker":"PETR4","range":"1A"}}'
```


### Atualização v21.12.59 — rankings iguais ao VALORAE sem depender dele

O endpoint de rankings agora usa primeiro as páginas específicas usadas pelo VALORAE:

```text
https://investidor10.com.br/acoes/rankings/maiores-altas/
https://investidor10.com.br/acoes/rankings/maiores-baixas/
```

Se essas páginas falharem ou vierem incompletas, o Proxy tenta os blocos `Maiores Altas` e `Maiores Baixas` da home do Investidor10. O contrato final preserva `rankings.altas` e `rankings.baixas` e adiciona aliases Android (`highs`, `lows`, `topGainers`, `topLosers`).

Para priorizar precisão sobre velocidade:

```text
/api/market/rankings?source=live&mode=complete&strict=1&limit=15
```

`strict=1` exige completude mínima configurável por `minRows`: cada item precisa ter ticker, preço e variação. Quando a fonte não fornece tudo, o Proxy marca `partial=true` e não inventa campos ausentes.

## Compatibilidade Vercel

- Sem banco obrigatório.
- Sem Redis/KV obrigatório.
- Sem filesystem persistente.
- Sem WebSocket ou worker permanente.
- Sem dependências novas.
- Cache continua em memória.
- Rotas continuam serverless.

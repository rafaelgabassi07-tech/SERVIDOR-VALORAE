# VALORAE Proxy — stock historical indicators REST i10 v256

Versão base: `21.12.0`  

Patch: `21.12.285-stock-historical-indicators-rest-i10-v256`  
Contrato de ação: `26.asset-modal.stock.v37`  
APK pareado: `apk_valorae_stock_historical_indicators_rest_i10_v375_AI_STUDIO_ROOT_OK_2026_07_05.zip`

## Alteração principal

O Proxy passa a tentar `GET https://investidor10.com.br/api/rest/assets/tickers/{TICKER}` para recuperar e normalizar o Histórico de Indicadores Fundamentalistas do modal de ação.

## Política

Sem fallback PETR4/GGRC11, sem mock e sem dado inventado. Se o Investidor10 não entregar histórico estruturável para o ticker solicitado, o bloco retorna `EMPTY`.

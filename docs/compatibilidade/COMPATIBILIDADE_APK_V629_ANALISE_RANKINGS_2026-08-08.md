# Compatibilidade APK v629 / Proxy 21.12.404

- APK pareado: `2026.08.08.07` (v629).
- Proxy público: `21.12.404`.
- Novo contrato: `GET /api/v1/analysis/rankings?rankingId=<ID>&limit=<N>`.
- IDs estáveis: STOCK_MARKET_CAP, STOCK_DIVIDEND_YIELD, STOCK_NET_MARGIN, FII_NET_WORTH, FII_DIVIDEND_YIELD, FII_MOST_SEARCHED, FII_LIQUIDITY, FII_PVP_HIGH, FII_PVP_LOW, FII_12M_GAIN.
- O parser é semântico: a posição das colunas na fonte não faz parte do contrato móvel.
- Valores e ordem do ranking são lidos novamente após o TTL; alteração normal dos dados não exige deploy.
- Se a fonte ficar incompleta ou estruturalmente incompatível, o último snapshot válido é preservado como STALE em vez de publicar dados vazios/incorretos.

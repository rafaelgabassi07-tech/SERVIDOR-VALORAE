# RELATÓRIO — Gráficos Investidor10 Canônicos · VALORAE Proxy v21.12.62

## Objetivo
Corrigir a extração dos gráficos das páginas de ações e FIIs do Investidor10 para que o APK VALORAE não monte gráficos pobres, sintéticos ou divergentes da página original.

## Páginas de referência verificadas
- Ação: PETR4 (`/acoes/petr4/`)
- FII: HGLG11 (`/fiis/hglg11/`)

## Problemas corrigidos
- Comparação com Índices podia ser montada por fallback genérico e não pela estrutura do Investidor10.
- Rentabilidade nominal vs real podia ficar incompleta ou derivada de histórico de preço.
- Evolução Lucro x Cotação não priorizava os endpoints internos descobertos na página.
- Balanço Patrimonial Ativo/PL/Passivo podia perder séries por diferença de nomes.
- Payout histórico dependia de formatos antigos e não de dados canônicos.

## Implementação Proxy
Arquivo novo:
- `lib/market/investidor10-chart-extractor.js`

Integração preservando núcleo:
- `lib/Valorae-engine.js` recebeu apenas integração ao mecanismo auxiliar, sem desmembrar o engine.

Contrato novo:
```text
/api/v1/asset?ticker=PETR4&view=app&profile=max&mode=complete&complete=1&charts=full&includeCharts=1&chartSource=investidor10&internalApis=1
```

Campo exposto ao APK:
```json
assetChartsCanonical: {
  profitability: { nominal: [], real: [] },
  indexComparison: [],
  financial: {
    revenueProfit: [],
    profitVsQuote: [],
    balanceSheet: [],
    payoutHistory: []
  }
}
```

## Estratégia de completude
- O Proxy descobre URLs `/api/...` dentro do HTML do Investidor10.
- Mantém HTML como fonte para Rentabilidade e Rentabilidade Real.
- Usa JSON interno de gráficos quando disponível.
- Não cria séries artificiais quando os dados canônicos não existem.

## Validações
- `npm run check`: 289 arquivos JS verificados.
- `VALORAE_TEST_TIMEOUT_MS=15000 npm test`: 90 arquivos executados; falhas=0.
- Teste novo: `test/investidor10-asset-charts-canonical-v21-12-62.test.js`.

## Limitação
Neste ambiente não foi possível consultar diretamente endpoints internos dinâmicos do Investidor10 via container por ausência de DNS/rede externa. O mecanismo foi implementado para executar no runtime do Proxy/Vercel, onde a rede pública está disponível.

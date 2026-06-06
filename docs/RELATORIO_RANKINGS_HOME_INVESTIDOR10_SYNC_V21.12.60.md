# VALORAE Proxy v21.12.60 — Rankings sincronizados com a Home do Investidor10

## Problema identificado
A tela inicial do APK VALORAE estava recebendo rankings com ativos e percentuais divergentes dos blocos visíveis na Home do Investidor10. O risco vinha de dois pontos:

1. o Proxy priorizava páginas dedicadas de ranking antes da Home;
2. quando a captura ao vivo falhava, a rota podia cair para comparação/cesta fixa, exibindo ativos que não estavam em `Maiores Altas` ou `Maiores Baixas` da Home.

## Correções aplicadas no Proxy

- A fonte canônica padrão para rankings ao vivo sem tickers agora é a Home do Investidor10.
- O parser ancora a extração na região de mercado/Ibovespa da Home, próxima de `Atualizado em`, `Maiores Altas`, `Maiores Baixas`, `Moedas` e `Índices`.
- O parser ignora ocorrências genéricas como `Maiores Altas - 30 dias` de outros menus/rankings.
- O Proxy separa altas e baixas usando o bloco real da Home, exigindo ticker, preço e variação.
- A rota `/api/v1/market/rankings` aceita/usa `source=home` para o APK.
- Para rankings ao vivo sem tickers, o fallback de comparação foi desativado para evitar dados divergentes.
- As páginas dedicadas continuam disponíveis apenas como modo opcional via `source=dedicated` ou `source=pages`.

## Contrato recomendado para o APK

```text
/api/v1/market/rankings?type=ACAO&source=home&mode=complete&complete=1&strict=1&limit=6&minRows=6
```

Fallback leve, ainda usando Home:

```text
/api/v1/market/rankings?type=ACAO&source=home&mode=auto&limit=6&minRows=6
```

## Resultado esperado
O APK deve exibir exatamente os ativos capturados nos blocos `Maiores Altas` e `Maiores Baixas` da Home do Investidor10, sem usar ranking dedicado, ranking fundamentalista ou cesta fixa como substituto silencioso.

## Arquivos alterados

- `lib/market/rankings-i10.js`
- `routes/market/rankings.js`
- `routes/openapi.js`
- `package.json`
- `metadata.json`
- `test/rankings-i10-valorae-mechanism-v21-12-59.test.js`

## Validação

- `node test/rankings-i10-valorae-mechanism-v21-12-59.test.js`
- `npm run check`
- `npm test`


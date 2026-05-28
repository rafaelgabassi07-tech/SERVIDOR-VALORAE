# Android Java Guide — Valorae v21.11.4

O cliente Java puro fica em:

```text
public/sdk/android-java/ValoraeClient.java
```

Ele usa apenas APIs padrão do Java/Android:

- `HttpURLConnection`
- timeouts configuráveis
- tratamento de erro HTTP
- fechamento seguro de streams

Exemplo:

```java
ValoraeClient client = new ValoraeClient("https://seu-deploy.vercel.app");
String ready = client.readyJson();
String manifest = client.manifestJson();
String petr4 = client.assetJson("PETR4", "quote", "quote");
String carteira = client.portfolioAnalyzeJson("{\"positions\":[{\"ticker\":\"PETR4\",\"quantity\":10,\"averagePrice\":32}]}");
```

## Rotas úteis

- `readyJson()`
- `manifestJson()`
- `assetJson()`
- `assetV2Json()`
- `assetsJson()`
- `compareJson()`
- `rankingsJson()`
- `portfolioAnalyzeJson()`
- `cacheStatsJson()`
- `openApiJson()`

## v21.11.4 — Scraper/API otimizado

O VALORAE agora possui cache final de resultado para `/api/scrape` e `/api/batch-scrape`, chave HTML segura contra contaminação por truncamento, batch coalescido por `fetchKey`, fast-path conservador para seletores simples, métricas detalhadas de scraping e controles mobile (`compact=1`, `previewChars` e `fields=`). Tudo permanece free-only, sem dependências obrigatórias e sem desmembrar `lib/Valorae-engine.js`.

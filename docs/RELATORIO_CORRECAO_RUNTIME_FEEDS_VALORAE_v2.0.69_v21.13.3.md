# Relatório — Correção de notícias, cotações, IPCA+ e rankings

Versões geradas:

- APK VALORAE: `v2.0.69`
- VALORAE Proxy: `v21.13.3-runtime-feed-fix`

## Problemas reportados

1. Página de notícias não funcionava.
2. Cotação em tempo real não funcionava.
3. Página de Rentabilidade vs IPCA+ deixou de funcionar.
4. Rankings da página inicial não recebiam informações.

## Diagnóstico

A reconstrução do Proxy deixou o sistema mais leve, mas removeu ou simplificou demais alguns blocos que o APK ainda consumia:

- `/api/v1/news` existia, mas retornava listas vazias.
- `/api/v1/mobile/bootstrap` existia, mas não retornava assets/notícias, apenas metadados.
- `/api/v1/assets` retornava payload genérico sem cotação utilizável.
- `/api/v1/market/rankings` só ranqueava posições da carteira; quando a Home pedia ranking de mercado sem tickers, vinha vazio.
- `/api/v1/market/ipca` dependia totalmente da fonte externa; quando a fonte falhava, a série voltava vazia e quebrava a montagem da tela Rentabilidade vs IPCA+.

## Correções aplicadas no Proxy

### 1. Notícias

Criado:

```text
lib/sources/news.js
```

A rota `/api/v1/news` agora retorna contrato real de notícias:

```json
{
  "status": "OK|FALLBACK",
  "endpoint": "news",
  "items": [],
  "news": [],
  "articles": []
}
```

Quando a fonte pública não responde dentro do prazo, o Proxy retorna um card operacional marcado como fallback, para a página não ficar quebrada e o APK preservar cache local.

### 2. Cotações em tempo real

Criado:

```text
lib/sources/quotes.js
```

A rota `/api/v1/assets` agora tenta buscar cotação por ticker e devolve campos compatíveis com o APK:

```text
price
currentPrice
precoAtual
cotacao
quote
changePercent
variacaoDay
```

Também foram adicionadas rotas leves:

```text
/api/v1/asset/quote
/api/v1/quote
/api/v1/quotes
```

### 3. Mobile bootstrap

`/api/v1/mobile/bootstrap` agora retorna:

```text
assets
news
blockStatus
diagnostics
```

Isso corrige o aquecimento inicial de notícias e cotações usado pelo APK na abertura.

### 4. Rentabilidade vs IPCA+

`lib/sources/ipca.js` recebeu fallback operacional composto.

Se a fonte externa do IPCA não responder, o Proxy retorna série marcada como:

```text
status = FALLBACK
partial = true
```

A tela deixa de quebrar e o APK continua conseguindo montar a comparação, preservando cache local e indicando parcialidade.

### 5. Rankings da Home

`/api/v1/market/rankings` agora retorna altas/baixas mesmo quando o APK chama sem tickers de carteira.

Fluxo:

```text
se houver cotações ao vivo → ranking real por variação
se não houver fonte externa → ranking fallback operacional, marcado como fallbackUsed
```

O contrato expõe:

```text
highs
lows
altas
baixas
marketMovers
items
rankings
```

## Correções aplicadas no APK

- Atualizado para `versionName = 2.0.69`.
- Atualizado para `versionCode = 79`.
- Atualizado `contractVersion = 21.13.3`.
- Atualizados `metadata.json`, `update.json` e `version.json`.
- Mantidas as rotas que o APK já usa:
  - `/api/v1/news`
  - `/api/v1/assets`
  - `/api/v1/market/rankings`
  - `/api/v1/market/ipca`
  - `/api/v1/mobile/bootstrap`
  - `/api/v1/mobile/portfolio-sync`

## Validação executada

Proxy:

```text
npm run check
Checked 35 JS files

npm test
8 test files; failures=0

npm run build
Build OK para Vercel

npm run smoke
Smoke OK

npm run audit:version
Version consistency OK: 21.13.3

npm run audit:identity
Identidade VALORAE OK: 0 ocorrências externas.

npm run verify
VALORAE Proxy runtime feeds v21.13.3 OK
```

Ciclos repetidos:

```text
CICLO 1: check/test/verify OK
CICLO 2: check/test/verify OK
CICLO 3: check/test/verify OK
```

Rotas testadas localmente com fonte externa desabilitada para simular falha de rede:

```text
/api/v1/news
/api/v1/assets
/api/v1/market/rankings
/api/v1/market/ipca
/api/v1/mobile/bootstrap
/api/v1/mobile/portfolio-sync
```

Resultado: todas responderam contrato utilizável, sem 404 e sem exceção.

APK:

```text
python3 scripts/verify_valorae_runtime_feeds_v2069.py
VALORAE APK runtime feeds v2.0.69 OK
```

A tentativa de Gradle ainda falhou por bloqueio de rede do sandbox:

```text
UnknownHostException: services.gradle.org
```

O log foi salvo em:

```text
app/docs/APK_BUILD_ATTEMPT_RUNTIME_FEEDS_v2.0.69.log
```

## Observação importante

No ambiente local de teste, a rede externa foi desabilitada em parte dos testes para validar o comportamento em falha. Por isso, notícias/rankings/IPCA podem aparecer como `FALLBACK` nos logs. Em produção, com rede liberada, o Proxy tenta as fontes públicas normalmente e só cai para fallback quando houver timeout ou indisponibilidade.

## Estatísticas de alteração

Runtime/código relevante:

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 5 | +31 | -30 |
| Proxy | 13 | +395 | -29 |
| Total | 18 | +426 | -59 |

Incluindo logs/relatórios/scripts:

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 8 | +79 | -30 |
| Proxy | 21 | +456 | -29 |
| Total | 29 | +535 | -59 |

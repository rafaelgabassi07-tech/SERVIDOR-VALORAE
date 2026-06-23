# VALORAE — Relatório v115: contrato APK + Proxy endurecido

Data: 2026-06-23
APK: 2026.06.23.1 / versionCode 26062301
Proxy: 21.12.159-apk-proxy-contract-hardening-v115

## Correções aplicadas

1. `/api/v1/assets` no roteador principal do Proxy agora delega para `routes/assets.js`, que já continha a lógica correta de sugestões inteligentes e pares setoriais.
2. `/api/v1/asset/history` no roteador principal do Proxy agora delega para o handler dedicado `routes/asset/history.js`.
3. `/api/v1/market/indices` no roteador principal do Proxy agora delega para o handler dedicado `routes/market/indices.js`, usando o snapshot paralelo/resiliente em vez do caminho sequencial antigo.
4. APK ganhou `ValoraeProxyClient.getQuoteHistoryWithDates(...)`, lendo histórico pelo Proxy em `/api/v1/asset/history`.
5. `YahooFinanceClient` do APK foi mantido somente como compatibilidade interna: não chama Yahoo direto, apenas delega para `ValoraeProxyClient`.
6. `ValoraeQuoteChartCard` passou a chamar `ValoraeProxyClient` diretamente.
7. `ValoraeProxyClient` passou a validar HTTP 2xx e status de erro do contrato antes de interpretar JSON.
8. Metadados, changelog, `version.json`, `update.json`, `.env.example` e release do Proxy foram sincronizados para v115.

## Validações executadas

- Proxy `npm run check`: OK — 252 arquivos JS verificados.
- Proxy `npm test`: OK — 67 arquivos de teste, 0 falhas.
- Proxy `npm run audit:version`: OK.
- Proxy `node scripts/audit-version-consistency.js`: OK.
- Smoke local do Proxy:
  - `/api/v1/ready`: OK, release v115.
  - `/api/v1/assets?q=PETR&suggest=true&searchMode=analysis`: retornou sugestões, incluindo PETR3/PETR4.
  - `/api/v1/assets?peerOf=PETR4&sameSector=true&searchMode=analysis_comparison`: retornou pares setoriais de petróleo/gás e não misturou BBAS3.
- APK JSON: `version.json`, `update.json`, `metadata.json`, `changelog.json` e `valorae_changelog.json`: OK.
- APK Kotlin estático: sem URLs diretas `query1.finance.yahoo` ou `query2.finance.yahoo` em `app/src/main/java`.
- APK Kotlin estático: arquivos modificados com balanceamento de chaves OK.
- Estrutura ZIP: APK e Proxy prontos para AI Studio, com arquivos diretamente na raiz.

## Observação sobre build Android

A build Android completa ainda não foi executada neste ambiente porque o pacote base não contém `gradlew` nem `gradle/wrapper/gradle-wrapper.jar`. As validações feitas foram estruturais, JSON, estáticas em Kotlin e completas no Proxy.

# VALORAE v101 — Cotações seguras, desempenho e gráfico da carteira

## Escopo

Checkpoint focado em três frentes solicitadas:

1. Implementar atualização segura de cotações via Yahoo Finance sem usar 3s/5s global.
2. Aplicar otimizações gerais de desempenho no APK.
3. Corrigir o gráfico **Cotação da carteira** para ter filtro do dia e respeitar o tempo real de existência da carteira.

## APK

Arquivos alterados:

- `app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt`
- `app/src/main/java/com/example/ui/PortfolioViewModel.kt`
- `app/src/main/java/com/example/ui/PortfolioScreen.kt`
- `app/src/main/assets/valorae_changelog.json`
- `changelog.json`
- `version.json`
- `update.json`
- `metadata.json`

### Cotações

- O APK passa a consumir `/api/v1/quotes` para cotações da carteira.
- As cotações são enviadas em lote, reduzindo chamadas repetidas.
- O cache local do cliente foi ajustado para 30 segundos.
- A atualização automática roda apenas em seções úteis: Início, Ativos e Análise.
- Não foi implementado polling de 3s/5s por segurança.

### Gráfico Cotação da carteira

- Adicionado filtro **1D**.
- Os períodos longos agora são limitados pela primeira data real do Histórico.
- Ativos que ainda não existiam dentro da janela filtrada não contribuem artificialmente para a curva.
- Se a carteira tem menos de 1 ano, filtros como 1A/5A/MÁX não exibem período anterior ao primeiro lançamento.

## Proxy

Arquivos alterados:

- `lib/sources/quotes.js`
- `routes/_router.js`
- `lib/core/release.js`
- `lib/release/current.js`
- `metadata.json`
- `package.json`
- `README.md`
- `PATCH_NOTES_2026_06_22_SAFE_YAHOO_QUOTES_V101.md`

### Política segura Yahoo Finance

- Cache curto: 30 segundos.
- Stale seguro: até 10 minutos.
- Backoff anti-429: 2 minutos por ticker/símbolo.
- Concorrência limitada para evitar rajadas agressivas.
- `/api/v1/quotes` aceita batch de tickers.
- Em falha temporária, o Proxy tenta preservar a última cotação válida quando disponível.

## Versionamento

APK preservado:

- `versionCode = 26061907`
- `versionName = 2026.06.19.7`

Proxy atualizado:

- Core: `21.12.0`
- Patch: `21.12.152-safe-yahoo-quotes-v101`

## Validação

- JSONs do APK validados.
- JSONs do Proxy validados.
- `npm run check` executado no Proxy: 250 JS files checked.
- `node --check` executado nos arquivos JS alterados.
- Contagem básica de chaves dos arquivos Kotlin alterados sem divergência.

## Observação

Build Android completa não foi executada porque o pacote não contém `gradlew` executável nem `gradle-wrapper.jar`.

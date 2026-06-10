# Relatório de auditoria completa — VALORAE APK v2.0.68 + VALORAE Proxy v21.13.1

Data: 2026-06-10

## Escopo

Auditoria profunda da versão reconstruída do ecossistema VALORAE:

- APK base auditado: `APK_VALORAE_v2.0.67-valorae-rebuilt-proxy-compatible.zip`
- Proxy base auditado: `valorae-proxy-v21.13.0-valorae-rebuilt-proxy.zip`
- APK entregue: `APK_VALORAE_v2.0.68-integration-audit-fix.zip`
- Proxy entregue: `valorae-proxy-v21.13.1-integration-audit-fix.zip`

Objetivo: repetir testes, corrigir incompatibilidades reais, revisar integração APK ↔ Proxy, remover fallback oculto no fluxo de carteira e preservar a arquitetura enxuta do VALORAE.

## Resultado executivo

A versão reconstruída v21.13.0 já estava leve e funcional nos testes básicos, mas a auditoria encontrou três riscos reais que poderiam afetar telas do APK:

1. `/asset/history` estava reaproveitando histórico de carteira, não um contrato de histórico de ativo.
2. `/dividends/batch` com lista vazia podia consultar agenda pública inteira, o que era pesado e incorreto para carteira vazia.
3. O APK ainda tinha um fallback por ativo em `deepSync` dentro de `fetchNextDividends`, mesmo após a reconstrução dizer que o fluxo deveria beber apenas de `/dividends/batch`.

Todos foram corrigidos.

## Correções aplicadas no Proxy

### 1. `/asset/history` corrigido

Antes:

```text
/asset/history -> buildHistory(payload)
```

Isso gerava histórico de carteira, e quando vinha apenas `ticker`, o resultado podia ser vazio ou sem semântica de ativo.

Agora:

```text
/asset/history -> buildAssetHistory(payload)
```

O contrato passa a retornar:

- `ticker`
- `points`
- `history`
- `series`
- `chartHistory`
- `status=EMPTY` quando não há preço-fonte suficiente

Assim o APK não recebe estrutura ambígua.

### 2. Dividendos com carteira vazia não consultam agenda inteira

Antes, se `tickers=[]`, a agenda poderia ser parseada sem filtro. Isso podia retornar muitos ativos que não pertenciam à carteira.

Agora:

```text
buildDividendsContract({ tickers: [] }) -> status EMPTY
```

Sem rede, sem agenda ampla e sem carga inútil.

### 3. Parser de agenda protegido contra cards compactos

Foi adicionado teste para caso compacto:

```text
FISC11 R$ 0,62 20/07/2026 FATN11 R$ 0,80 21/07/2026
```

Agora cada ticker só lê o próprio segmento, evitando trocar valor/data entre ativos.

### 4. Contrato mobile mais resiliente

`buildMobilePortfolioSync` agora calcula blocos com isolamento de falhas. Um erro em IPCA ou proventos não derruba análise/histórico local do contrato.

Blocos possíveis:

- `analysis`
- `history`
- `ipca`
- `dividends`
- `rankings`

Status possíveis:

- `OK`
- `EMPTY`
- `SKIPPED`
- `ERROR`

## Correções aplicadas no APK

### 1. Versão e contrato atualizados

- `versionName = 2.0.68`
- `versionCode = 78`
- `contractVersion = 21.13.1`

### 2. Fallback oculto por ativo removido do fluxo de proventos

Antes, em `deepSync`, `fetchNextDividends` ainda podia fazer fan-out por ativo usando `fetchAssetDividendEvents` quando `/dividends/batch` vinha incompleto.

Agora, a função usa apenas:

```text
/api/v1/dividends/batch
```

Se vier vazio, o APK preserva cache/snapshot local e aguarda nova sincronização. Isso reduz chamadas escondidas e mantém a filosofia de Proxy enxuto.

### 3. Verificador estático atualizado

Novo verificador:

```text
scripts/verify_valorae_rebuilt_proxy_v2068.py
```

Valida:

- versão do APK;
- versão do contrato Proxy;
- rota mobile canônica;
- ausência de fallback oculto mobile;
- ausência de fan-out de dividendos para rotas antigas;
- ausência de fallback por ativo dentro do batch de carteira;
- metadados `metadata.json`, `update.json` e `version.json`.

## Cobertura de rotas APK ↔ Proxy

As rotas chamadas pelo APK em `B3NetworkService.kt` foram comparadas com o Proxy v21.13.1 e testadas localmente.

Rotas auditadas:

```text
/api/fields
/api/observability
/api/openapi
/api/server/metrics
/api/v1/asset
/api/v1/asset/dividends
/api/v1/asset/next-dividend
/api/v1/assets
/api/v1/dividends/batch
/api/v1/integration/manifest
/api/v1/market/indices
/api/v1/market/ipca
/api/v1/market/rankings
/api/v1/mobile/portfolio-sync
/api/v1/news
/api/v1/portfolio/analyze
/api/v1/portfolio/history
/api/v1/ready
/api/v1/release/readiness
/api/v1/source/status
```

Resultado:

```text
APK route coverage OK
```

Nenhuma rota usada pelo APK retornou `NOT_FOUND`.

## Testes repetidos

### Proxy

Executado ciclo completo e depois repetição tripla de auditoria:

```text
npm run check
npm test
npm run build
npm run smoke
npm run audit:version
npm run audit:identity
npm run verify
```

Resultado final:

```text
Checked 29 JS files
6 test files; failures=0
Build OK para Vercel
Smoke OK
Version consistency OK: 21.13.1
Identidade VALORAE OK: 0 ocorrências externas.
VALORAE Proxy integration audit v21.13.1 OK
```

Ciclos repetidos:

```text
CICLO 1: OK
CICLO 2: OK
CICLO 3: OK
```

### APK

Validação estática:

```text
python3 scripts/verify_valorae_rebuilt_proxy_v2068.py
VALORAE APK v2.0.68 integration audit OK
```

Tentativa Gradle:

```text
./gradlew test --no-daemon
```

Resultado: bloqueado pelo sandbox por `UnknownHostException: services.gradle.org`. O erro é de rede/DNS do ambiente, não uma falha confirmada do código.

## Arquivos principais alterados

### Proxy

- `lib/contracts/mobile.js`
- `lib/portfolio/analysis.js`
- `lib/portfolio/dividends-contract.js`
- `lib/sources/agenda-dividends.js`
- `routes/_router.js`
- `test/asset-history.test.js`
- `test/dividends-contract.test.js`
- `scripts/verify-integration-audit-v21-13-1.js`
- `package.json`
- `metadata.json`
- `public/service-worker.js`
- `public/server.html`

### APK

- `app/build.gradle.kts`
- `app/src/main/java/com/example/network/B3NetworkService.kt`
- `metadata.json`
- `update.json`
- `version.json`
- `scripts/verify_valorae_rebuilt_proxy_v2068.py`
- `docs/VALORAE_PROXY_INTEGRATION.md`

## Estatísticas de alterações

### Runtime/código relevante

| Projeto | Arquivos runtime antigos | Arquivos runtime novos | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|---:|---:|
| APK | 85 | 85 | 5 | +26 | -30 |
| Proxy | 31 | 31 | 10 | +147 | -41 |

### Incluindo logs, relatórios e documentação

| Projeto | Arquivos antigos | Arquivos novos | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|---:|---:|
| APK | 94 | 90 | 17 | +66 | -402 |
| Proxy | 50 | 50 | 36 | +227 | -286 |

## Conclusão

A auditoria não encontrou falhas restantes nos testes locais executados após as correções.

A versão final ficou mais coerente com a proposta:

```text
APK usa contrato mobile único
↓
/dividends/batch é a única fonte remota de carteira para proventos
↓
sem fallback oculto por ativo no fluxo de carteira
↓
rotas usadas pelo APK respondem no Proxy
↓
monitor e metadados alinhados com v21.13.1
```

Pendência externa: apenas a compilação Gradle real, que não pôde ser concluída neste sandbox por bloqueio de DNS ao baixar o Gradle.

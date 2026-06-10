# Relatório técnico — VALORAE identidade preservada + contrato nativo

**APK:** VALORAE v2.0.65 / versionCode 75  
**Proxy:** VALORAE Proxy v21.12.93-valorae-native-contract-polish  
**Foco:** identidade própria, integração APK ↔ Proxy, limpeza de resíduos e validação de contrato.

## 1. Diretriz aplicada

O ecossistema VALORAE deve manter identidade própria em código, contratos, respostas públicas, relatórios, metadados, scripts e artefatos.

A lógica de simplificação permanece nativa do VALORAE:

```text
APK VALORAE
↓
/api/v1/mobile/portfolio-sync
↓
VALORAE Proxy entrega blocos normalizados
↓
APK monta carteira, agenda, evolução, análise e rankings com cache/fallback seguro
```

## 2. Correções no APK

- Atualizado para `versionName = 2.0.65` e `versionCode = 75`.
- `metadata.json`, `update.json` e `version.json` alinhados à versão atual.
- `contractVersion` enviado pelo APK atualizado para `21.12.93`.
- `clientContract` preservado como `valorae-mobile-portfolio-sync`.
- Fluxo normal continua usando `/api/v1/mobile/portfolio-sync` primeiro.
- Fallback para `/api/v1/portfolio/insights-bundle` preservado apenas como compatibilidade.
- Rankings permanecem fora do boot normal, entrando em fluxo profundo/forçado.
- `dividendPositions` preservado para proventos retroativos.
- Removidos scripts antigos de validação versionada que não faziam parte do runtime.
- Removida pasta `app/applet`, que continha testes soltos de scraping e relatório antigo fora do fluxo Android.
- Removidos relatórios/logs antigos gerados por rodadas anteriores.

## 3. Correções no Proxy

- Atualizado para release pública `21.12.93-valorae-native-contract-polish`.
- `lib/release/current.js` mantido como fonte única da release pública.
- Contrato público mantido como:

```json
{
  "contract": {
    "name": "valorae-mobile-portfolio-sync",
    "version": "21.12.93",
    "style": "valorae-single-request-cache-first"
  }
}
```

- Service worker/cache atualizado para `valorae-proxy-server-v21-12-93`.
- Metadados públicos alinhados para `21.12.93`.
- Scripts antigos de validação versionada foram removidos, mantendo apenas os validadores atuais.
- Blocos opcionais seguem respeitados:
  - `includeAnalysis`
  - `includeHistory`
  - `includeIpca`
  - `includeDividends`
  - `includeRankings`
- `includeRankings` continua desligado por padrão no boot mobile.
- Coalescing/in-flight segue usando assinatura estável por payload e flags, evitando compartilhar resposta errada entre chamadas diferentes.

## 4. Varredura de identidade

Foi executada varredura textual nos projetos `apk` e `proxy` para impedir nomes externos nos artefatos VALORAE.

Resultado:

```text
0 ocorrências encontradas
```

## 5. Validação executada

### Proxy

```text
npm run check
Checked 301 JS files
```

```text
npm test
93 arquivos executados; falhas=0; lentos=nenhum
```

```text
npm run build
Build OK para Vercel
```

```text
npm run smoke
Smoke OK
```

```text
npm run audit:version
Version consistency OK: core 21.12.0; release 21.12.93-valorae-native-contract-polish.
```

```text
node scripts/verify-valorae-native-contract-v21-12-93.js
VALORAE Proxy native contract v21.12.93 OK
```

```text
node scripts/smoke-mobile-portfolio-contract-v21-12-93.js
Mobile portfolio contract smoke v21.12.93 OK
```

### APK

```text
python3 scripts/verify_valorae_native_contract_v2065.py
VALORAE APK native contract v2.0.65 OK
```

A tentativa de Gradle foi executada, mas o sandbox não conseguiu acessar `services.gradle.org`, retornando `UnknownHostException`. O log foi preservado em:

```text
app/docs/APK_BUILD_ATTEMPT_NATIVE_CONTRACT_v2.0.65.log
```

## 6. Linhas adicionadas/removidas

Sem contar logs/relatórios gerados automaticamente:

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 48 | +66 | -1973 |
| Proxy | 47 | +138 | -1007 |
| Total | 95 | +204 | -2980 |

Contando logs/relatórios e documentação de validação:

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| APK | 67 | +137 | -6059 |
| Proxy | 75 | +180 | -4916 |
| Total | 142 | +317 | -10975 |

## 7. Conclusão

A rodada preservou a identidade VALORAE, removeu nomenclaturas externas dos artefatos, limpou resíduos antigos, manteve o contrato mobile simples e validou o Proxy com suíte completa. O APK passou na validação estática própria; a compilação Gradle não pôde ser confirmada neste ambiente por bloqueio de rede ao baixar a distribuição do Gradle.

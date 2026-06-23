# RELATÓRIO — Comparação: auditoria, correções e Proxy v103

Data: 2026-06-22  
Checkpoint: `comparison-modal-audit-proxy-v103`  
APK base auditado: `apk-valorae (24).zip` / checkpoint v102  
Proxy base: `21.12.152-safe-yahoo-quotes-v101`  
APK versionCode/versionName preservados: `26061907` / `2026.06.19.7`  
Proxy patch: `21.12.153-analysis-comparison-decision-v103`

## Objetivo ativo
Realizar nova auditoria do modal de Comparação e seguir com as correções/melhorias necessárias, incluindo o Proxy quando necessário.

## Auditoria realizada
Foram revisados:

- `app/src/main/java/com/example/ui/AnalysisComparisonModal.kt`
- `app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt`
- `app/src/main/java/com/example/data/proxy/ValoraeProxyModels.kt`
- `routes/assets.js`
- `lib/catalogs/asset-peers.js`
- testes do Proxy relacionados a pares setoriais e comparação
- JSONs de changelog/versionamento do APK

## Problemas encontrados

1. O comparador ainda podia perder ou priorizar mal indicadores quando cada ativo recebia o mesmo dado em seções diferentes.
2. A normalização de indicadores equivalentes precisava ser mais forte para rótulos como P/VP, Preço/VP, P/L, Preço/Lucro, DY, Dividend Yield, VPA, LPA e liquidez.
3. A leitura numérica precisava ser mais tolerante para valores com `x`, `%`, `R$`, `mi`, `bi` e `mil`.
4. A decisão de compatibilidade setorial ainda dependia muito do catálogo local do APK. Quando o ticker não estava no catálogo, o app não inferia bem o `peerGroup` a partir do setor/segmento da análise.
5. O Proxy já tinha pares setoriais, mas não expunha metadados suficientes para deixar claro se a comparação era de decisão ou apenas informativa.
6. A normalização de `peerGroup` no Proxy podia confundir categorias financeiras amplas, especialmente bancos, seguradoras e infraestrutura de mercado, além de FIIs de papel/logística/shopping.

## Correções aplicadas no APK

- `collectComparisonMetricBuckets()` agora escolhe a melhor versão de cada indicador por qualidade:
  - peso do indicador;
  - valor numérico válido;
  - prioridade da seção;
  - rótulo mais conciso.
- Criada normalização canônica de indicadores para melhorar casamento entre rótulos diferentes.
- `toComparisonNumber()` foi reforçado para aceitar valores como:
  - `7,2x`;
  - `15,4%`;
  - `R$ 10,50`;
  - `1,3 mi`;
  - `2,5 bi`;
  - `300 mil`.
- `buildComparisonProfile()` agora infere `peerGroup` usando setor/segmento vindos da página de Análise quando o ticker não está no catálogo local.
- A inferência de `peerGroup` agora separa melhor:
  - bancos;
  - seguradoras;
  - infraestrutura de mercado;
  - energia elétrica;
  - saneamento;
  - FIIs de recebíveis, logística, shopping, renda urbana e híbridos;
  - ETFs Brasil/exterior;
  - BDRs de tecnologia.
- O modal mantém a regra: campeão forte apenas quando o par é realmente comparável; caso contrário, comparação informativa.
- Changelog, `version.json`, `update.json` e `metadata.json` do APK foram sincronizados para v103.

## Correções aplicadas no Proxy

- `lib/catalogs/asset-peers.js`:
  - `normalizePeerGroup()` revisado para evitar mistura de grupos amplos.
  - `describePeerCompatibility()` agora retorna:
    - `sameSector`;
    - `confidence`;
    - `comparisonMode`.
- `routes/assets.js`:
  - sugestões setoriais agora expõem:
    - `comparisonMode`;
    - `comparisonConfidence`;
    - `peerQuality`;
    - `comparisonContract`.
  - `searchPolicy` atualizado para `analysis_same_sector_suggestions_v103`.
  - `uiPolicy.presentation` atualizado para `analysis_sector_peer_cards_v103`.
- `package.json`, `metadata.json` e `lib/core/release.js` atualizados para:
  - `21.12.153-analysis-comparison-decision-v103`.
- Adicionado teste:
  - `test/analysis-comparison-decision-v103.test.js`.

## Validação executada

### APK
- JSONs validados:
  - `changelog.json`
  - `app/src/main/assets/valorae_changelog.json`
  - `version.json`
  - `update.json`
  - `metadata.json`
- Conferência estrutural do Kotlin:
  - chaves/parênteses balanceados em `AnalysisComparisonModal.kt`.
- Varredura parcial com `kotlinc`:
  - interrompe nas dependências AndroidX/Compose ausentes no ambiente;
  - não foram encontrados erros de sintaxe antes das dependências externas.

### Proxy
- `node --check lib/catalogs/asset-peers.js`: OK.
- `node --check routes/assets.js`: OK.
- `node --check lib/core/release.js`: OK.
- `npm run check`: OK, 251 arquivos JS verificados.
- `npm test`: OK, 66 arquivos de teste, 0 falhas.
- Novo teste v103: OK.

## Limitações

- Build Android completa não foi executada porque o APK não contém `gradlew` executável nem `gradle-wrapper.jar`.
- A comparação continua dependente da qualidade dos dados retornados por `/api/v1/analysis`. Quando os dois ativos não têm indicadores equivalentes suficientes, o app corretamente evita declarar campeão forte.

## Resultado

O modal de Comparação ficou mais confiável para:

- sugerir pares setoriais;
- não misturar classes incompatíveis;
- declarar campeão somente quando houver base suficiente;
- comparar indicadores equivalentes mesmo com nomes diferentes;
- interpretar números financeiros com sufixos comuns;
- usar o Proxy como apoio real, e não apenas o APK.

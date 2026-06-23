# Patch 21.12.153 — Análise Comparação Decision v103

## Objetivo
Apoiar o modal de Comparação do APK com metadados setoriais mais confiáveis, reduzindo mistura de pares incompatíveis e deixando claro quando o par deve ser tratado como comparação de decisão ou apenas informativa.

## Mudanças no Proxy
- `lib/catalogs/asset-peers.js`:
  - Normalização de `peerGroup` revisada para não misturar bancos, seguradoras e infraestrutura de mercado.
  - Regras de FIIs priorizam recebíveis, logística, shopping, renda urbana e híbrido antes de categorias genéricas.
  - `describePeerCompatibility()` agora retorna `sameSector`, `confidence` e `comparisonMode`.
- `routes/assets.js`:
  - Sugestões `/api/v1/assets?peerOf=...` passaram a expor `comparisonMode`, `comparisonConfidence`, `peerQuality` e `comparisonContract`.
  - Política visual atualizada para `analysis_sector_peer_cards_v103`.
- `test/analysis-comparison-decision-v103.test.js`:
  - Adicionado teste para BBAS3/ITUB4, BBAS3/BBSE3, seguros, infraestrutura e recebíveis imobiliários.

## Validação
- `node --check lib/catalogs/asset-peers.js` OK.
- `node --check routes/assets.js` OK.
- `npm run check` OK, 251 arquivos JS verificados.
- `npm test` OK, 66 arquivos de teste, 0 falhas.

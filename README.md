# Valorae Proxy — v236

Core version: 21.12.0  
Public version: 21.12.266  
Patch: `21.12.266-deep-cleanup-unused-residue-v236`  
Checkpoint: `deep-cleanup-unused-residue-v236`

## Destaque

Limpeza profunda de resquícios técnicos abandonados após a migração para modal único com contratos separados de FII e ação. A entrega remove o fluxo antigo de modal via `/api/v1/analysis`, a resposta `modal-reset` e a injeção `assetAnalysisPage` no motor legado, preservando `/api/v1/asset/fii-modal`, `/api/v1/asset/stock-modal` e a busca inteligente da página Análise.

### Checkpoint 2026-07-03 — v332/v213

Implementa **Comunicados do FII** no modal único: o Proxy v213 captura a seção do Investidor10 e entrega `announcements` no contrato `26.asset-modal.fii.v20`; o APK v332 renderiza lista paginada com botão **Abrir PDF/Abrir**.

### Checkpoint 2026-07-03 — v331/v212

Revisão de paridade do modal único de FII. O Proxy v212 mantém `26.asset-modal.fii.v19` e acompanha o APK v331 na revisão da seção **Informações sobre valor patrimonial** e **Média do tipo e segmento**.

### Checkpoint 2026-07-03 — v330/v211

Correção do gráfico **Comparação com índices** no modal único de FIIs: IFIX, SMLL e IDIV passam a reutilizar a mesma camada `getAssetHistory` da página Retorno, mantendo os seletores fixos e a simulação de R$ 1.000,00 por período.


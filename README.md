# Valorae Proxy — v209

Core version: 21.12.0  
Public version: 21.12.239  
Patch: `21.12.239-fii-dividend-charts-fix-v209`  
Checkpoint: `fii-dividend-charts-fix-v209`

## Destaque

Evolui o contrato do modal único de FIIs para `26.asset-modal.fii.v16`, adicionando o objeto `vacancyHistory` com histórico da taxa de vacância, filtros por período e dados de vacância/ocupação para renderização mobile no APK v327.

### Checkpoint 2026-07-03 — v332/v213

Implementa **Comunicados do FII** no modal único: o Proxy v213 captura a seção do Investidor10 e entrega `announcements` no contrato `26.asset-modal.fii.v20`; o APK v332 renderiza lista paginada com botão **Abrir PDF/Abrir**.

### Checkpoint 2026-07-03 — v331/v212

Revisão de paridade do modal único de FII. O Proxy v212 mantém `26.asset-modal.fii.v19` e acompanha o APK v331 na revisão da seção **Informações sobre valor patrimonial** e **Média do tipo e segmento**.

### Checkpoint 2026-07-03 — v330/v211

Correção do gráfico **Comparação com índices** no modal único de FIIs: IFIX, SMLL e IDIV passam a reutilizar a mesma camada `getAssetHistory` da página Retorno, mantendo os seletores fixos e a simulação de R$ 1.000,00 por período.


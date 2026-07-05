# Valorae Proxy — v245

Core version: 21.12.0  
Public version: 21.12.274  
Patch: `21.12.274-stock-modal-i10-integrity-v245`  
Checkpoint: `stock-modal-i10-integrity-v245`

## Destaque

Auditoria reforçada do modal único de ação: Payout, Histórico de Indicadores Fundamentalistas e Checklist Buy and Hold passam por leitura mais resiliente do Investidor10, sem fallback PETR4/GGRC11, sem mock e sem dado fabricado.

# Valorae Proxy — v209

Core version: 21.12.0  
Public version: 21.12.272  
Patch: `21.12.272-stock-historical-indicators-investidor10-v243`  
Checkpoint: `fii-dividend-charts-fix-v209`

## Destaque

Corrige o checklist Buy and Hold de ações no modal único: o Proxy deixa de cortar a seção no item de dividendos e retorna os 10 critérios públicos do Investidor10 quando a fonte os disponibiliza, mantendo a política sem fallback estático.

### Checkpoint 2026-07-04 — v361/v242

Checklist Buy and Hold de ações via Investidor10 completo no contrato `26.asset-modal.stock.v23`; status dos critérios não é simulado por métricas locais, ficando `UNKNOWN` quando a marcação real não estiver presente.

Evolui o contrato do modal único de FIIs para `26.asset-modal.fii.v16`, adicionando o objeto `vacancyHistory` com histórico da taxa de vacância, filtros por período e dados de vacância/ocupação para renderização mobile no APK v327.

### Checkpoint 2026-07-03 — v332/v213

Implementa **Comunicados do FII** no modal único: o Proxy v213 captura a seção do Investidor10 e entrega `announcements` no contrato `26.asset-modal.fii.v20`; o APK v332 renderiza lista paginada com botão **Abrir PDF/Abrir**.

### Checkpoint 2026-07-03 — v331/v212

Revisão de paridade do modal único de FII. O Proxy v212 mantém `26.asset-modal.fii.v19` e acompanha o APK v331 na revisão da seção **Informações sobre valor patrimonial** e **Média do tipo e segmento**.

### Checkpoint 2026-07-03 — v330/v211

Correção do gráfico **Comparação com índices** no modal único de FIIs: IFIX, SMLL e IDIV passam a reutilizar a mesma camada `getAssetHistory` da página Retorno, mantendo os seletores fixos e a simulação de R$ 1.000,00 por período.
## Checkpoint v244 — Gráfico de Payout de ações

- Proxy `21.12.273-stock-payout-chart-investidor10-v244`.
- Contrato de ação `26.asset-modal.stock.v25`.
- Corrige o gráfico Payout do modal único de ação usando o payload real do Investidor10 para Lucro Líquido, Payout e Dividend Yield.
- Sem fallback estático ou dados simulados.

## Checkpoint v245 — Auditoria Investidor10 do modal de ação

- Proxy `21.12.274-stock-modal-i10-integrity-v245`.
- Contrato de ação `26.asset-modal.stock.v26`.
- Corrige Payout, Histórico de Indicadores Fundamentalistas e Checklist Buy and Hold com dados reais do Investidor10.
- Remove reaproveitamento de lucro anual como Últ 12M no Payout; se a fonte não entregar, fica indisponível.
- Mantém política sem PETR4/GGRC11 fixo, sem mock e sem fallback simulado.


## Checkpoint v246 — Histórico de Indicadores Fundamentalistas de ações

- Contrato de ação: `26.asset-modal.stock.v27`.
- Corrige o histórico de indicadores fundamentalistas do modal de ação com busca de `companyId`/`tickerId` por payloads reais do Investidor10 quando o HTML não expõe os IDs.
- Adiciona chamadas reais para rotas de indicadores `chart`, `table` e `historico-indicadores`, sem PETR4/GGRC11 fixo e sem mock.
- Normalizador aceita Chart.js aninhado, datasets, arrays por período e linhas transpostas por ano.
- Validação: `npm test` com 114 arquivos e 0 falhas.

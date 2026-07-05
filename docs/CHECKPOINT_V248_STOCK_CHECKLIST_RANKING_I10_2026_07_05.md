# Checkpoint v248 — Checklist de ações via ranking oficial Investidor10

Data: 2026-07-05  
Proxy: 21.12.277-stock-checklist-ranking-i10-v248  
Contrato: 26.asset-modal.stock.v29  
APK pareado: v367

## Correção

O checklist Buy and Hold de ações estava renderizando os 10 critérios, mas com todos os estados `UNKNOWN`, porque a página pública do ativo no Investidor10 expõe os textos dos critérios e nem sempre expõe a marcação visual dos checkboxes no HTML estático capturado pelo Proxy.

A correção preserva a regra sem dados simulados:

- primeiro usa a marcação explícita do próprio bloco de checklist quando ela vier no HTML;
- se o HTML só trouxer os textos, consulta a página oficial `Ações > Rankings > Buy And Hold` do Investidor10;
- quando a pontuação oficial é `100/100`, marca os 10 critérios como atendidos, pois o próprio Investidor10 documenta que cada critério vale 10 pontos;
- quando a pontuação for menor, usa apenas métricas reais disponíveis do Investidor10 e mantém `UNKNOWN` no que não puder ser comprovado.

## Fontes reais usadas

- Página do ativo no Investidor10.
- Ranking oficial Buy and Hold do Investidor10.
- Indicadores fundamentalistas e dados da empresa já extraídos do Investidor10.

## Sem fallback

Não há PETR4 fixo, GGRC11 fixo, mock, snapshot estático ou valor inventado.

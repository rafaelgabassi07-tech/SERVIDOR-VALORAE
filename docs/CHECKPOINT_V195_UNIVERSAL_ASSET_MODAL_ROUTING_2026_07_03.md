# Checkpoint v195 — Roteamento universal para o modal único do ativo

Data: 2026-07-03  
Proxy release: `21.12.225-universal-asset-modal-routing-v195`

## Objetivo

Acompanhar o APK v314 e impedir regressão do fluxo antigo da página Análise. A Análise não deve mais abrir uma tela própria com detalhes completos de ativo; qualquer ticker selecionado deve abrir o modal único `AssetDetailsModal`.

## Auditoria adicionada

- `analysis-universal-modal-v195.test.js` valida que `AnalysisScreen.kt` não chama `ValoraeProxyClient.getAnalysisPage`.
- Valida busca por teclado, sugestões, rankings/categorias, subpáginas da Análise e tickers em notícias.

## Compatibilidade

`/api/v1/analysis` permanece no Proxy para compatibilidade de contrato e uso futuro, mas não deve ser acionado pela busca/listagem da página Análise no APK.

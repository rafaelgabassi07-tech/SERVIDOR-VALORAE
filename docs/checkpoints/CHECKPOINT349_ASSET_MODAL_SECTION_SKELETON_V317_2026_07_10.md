# Checkpoint 349 — Asset modal section skeleton v317

## Objetivo

Evitar que a entrega `full` seja marcada como concluída quando apenas uma parte de um grupo visual pesado chegou. O APK v480 mantém skeleton por seção enquanto `isRefreshingDetails` está ativo; portanto o Proxy precisa declarar completude com a mesma granularidade funcional da tela.

## Alterações

- Runtime: `26.asset-modal.runtime.v16-section-complete-skeleton`.
- `fundamentalIndicators` reconhece itens da raiz e itens agrupados.
- `dividends` exige histórico, radar com evidência real e payout.
- `company` exige perfil, dados e informações da empresa.
- `revenueBreakdown` exige regiões e negócios.
- `financialCharts` exige receitas/lucros, lucro/cotação e evolução patrimonial.
- `financialStatements` exige DRE e balanço.
- `patrimonialInfo` de FII reconhece também linhas de média do segmento.

## Comportamento de falha

A política não cria carregamento infinito. Quando os deadlines e tentativas de recovery são encerrados, o contrato permanece parcial/retryable e o APK encerra `isRefreshingDetails`, substituindo o skeleton pela mensagem normal de indisponibilidade da seção.

## Pareamento

- APK: v480 / checkpoint70.
- Proxy público: 21.12.349.
- Patch: `21.12.349-asset-modal-section-skeleton-v317`.
- Protocolo móvel: `2026.07.10.10`.
- Asset modal delivery: schema v2.

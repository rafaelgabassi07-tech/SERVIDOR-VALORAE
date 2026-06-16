# VALORAE Proxy — Correções de lógica da agenda de proventos

## Correções aplicadas

- `normalizeTransactions()` agora reconhece também agrupamento/grupamento, amortização e transferência de saída como movimentações redutoras de quantidade.
- `quantityAtDate()` passa a refletir melhor compras, vendas e eventos redutores enviados pelo APK antes da data-com.
- Adicionado teste específico para cálculo de quantidade elegível por data-com com histórico de operações.

## Regra preservada

O Proxy continua retornando eventos oficiais e o APK faz o recorte final por ativos da carteira.

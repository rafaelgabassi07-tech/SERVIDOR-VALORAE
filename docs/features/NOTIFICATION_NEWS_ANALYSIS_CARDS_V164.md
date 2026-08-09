# Proxy v164 — Notícias claras e fundamentos sob demanda

Ajusta o contrato de quotes para suportar melhor o carregamento sob demanda de P/VP e DY nas subpáginas de categorias da Análise.

## Ajustes

- `/api/v1/quotes` aumenta o limite padrão de lote para 180 tickers quando o APK não informar `max`.
- Timeout padrão de fundamentos no roteador sobe para 6500 ms para reduzir respostas sem P/VP e DY em cargas por categoria.
- Mantém contrato com `assets`, `quotes`, `items` e `results`, incluindo `pvp`, `pvpDisplay`, `dividendYield` e `dividendYieldDisplay` quando a fonte entrega.

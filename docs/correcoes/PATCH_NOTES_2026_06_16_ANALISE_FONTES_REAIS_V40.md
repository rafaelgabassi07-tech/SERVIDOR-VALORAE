# 2026-06-16 — Análise: fontes reais para demonstrativos e receita

Patch: `21.12.124-analysis-source-extraction-v40`

## Correções

- A rota `/api/v1/analysis` passa a aproveitar dados anuais multi-período vindos das páginas reais do StatusInvest/Investidor10 quando disponíveis.
- Demonstrativos financeiros agora aceitam estruturas anuais como `valores`, `anos`, `years`, `periodos`, `periods` e tabelas equivalentes.
- DRE, Balanço e Fluxo de Caixa só geram gráfico por período quando há pelo menos dois períodos reais.
- Extração de receita por negócio/região foi ampliada para formatos de gráficos usados por páginas como Investidor10: `labels/datasets`, `series/categories`, objetos `{name,y}`, `{label,value}` e buckets por ano.
- Mensagens técnicas de ausência de dados continuam bloqueadas para o usuário final.

## Segurança de contrato

- Sem dados sintéticos.
- Sem uso de HTML/WebView no APK.
- Sem alteração nos contratos antigos de outros modais.

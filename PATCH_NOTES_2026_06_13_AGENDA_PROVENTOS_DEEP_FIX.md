# PATCH_NOTES_2026_06_13_AGENDA_PROVENTOS_DEEP_FIX.md

## Objetivo
Reforçar a deduplicação dos eventos de proventos antes da resposta ao APK, especialmente para FIIs duplicados entre StatusInvest e Investidor10 com diferença de centavos.

## Proxy
- Para FIIs, a deduplicação considera uma única distribuição por ticker + data de pagamento, mesmo que a família venha como RENDIMENTO, DIVIDENDO ou PROVENTO em fontes diferentes.
- StatusInvest continua como fonte preferencial por ativo quando houver conflito de valor.
- `assetClass` da posição passa a ser preservado no evento enriquecido para ajudar o APK a classificar e deduplicar com segurança.
- Teste do BTCI11 ampliado para cobrir diferença de centavos e diferença de tipo de provento entre fontes.

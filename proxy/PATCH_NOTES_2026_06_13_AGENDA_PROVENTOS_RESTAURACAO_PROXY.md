# PATCH_NOTES_2026_06_13_AGENDA_PROVENTOS_RESTAURACAO_PROXY

## Contexto
Após a revisão final, Agenda e Proventos podiam aparentar não receber dados do Proxy quando a fonte retornava eventos oficiais sem data-com/data-ex real, mas com competência/referenceDate.

## Causa
A competência do provento estava sendo tratada como data-com. Com isso, eventos que deveriam aparecer como “A confirmar” eram classificados como inelegíveis conhecidos e filtrados no APK.

## Correções no APK
- Adicionado `eligibilityKnown` ao contrato de evento de provento.
- A filtragem agora só remove evento inelegível quando existe inelegibilidade realmente conhecida.
- Respostas HTTP inválidas do Proxy passam a virar erro real, não agenda vazia silenciosa.

## Correções no Proxy
- `referenceDate`/competência deixou de ser usada como data-com.
- Eventos sem data-com real continuam sendo enviados como elegibilidade desconhecida.
- Eventos com data-com real e carteira inelegível continuam fora da agenda da carteira.

## Versão
Version Code mantido: 26061314
Version Name mantido: 2026.06.13.3

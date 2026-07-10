# Checkpoint 346 — Asset modal recovery cache upgrade v314

Proxy `21.12.346-asset-modal-recovery-cache-upgrade-v314`, pareado ao APK v477 / `2026.07.10.7`.

## Causa raiz

Quando o producer full terminava depois do deadline HTTP, ele aquecia o cache corretamente. Entretanto, uma chamada com `recovery=true` ignorava esse cache fresco e iniciava outra coleta pesada. A reabertura comum do modal não usava recovery e, por isso, encontrava o cache pronto — origem do comportamento “só carrega na segunda abertura”.

## Correções

- O APK informa completude, seções profundas e seções já disponíveis.
- O Proxy compara essa qualidade com o cache fresco antes de revalidar.
- Cache completo retorna como `RECOVERY_CACHE_COMPLETE`.
- Cache melhor, mas parcial, retorna como `RECOVERY_CACHE_UPGRADE` e mantém o producer em segundo plano.
- `requestId` e `requestedStage` são recontextualizados para a tentativa atual.
- Clientes sem os novos campos preservam o comportamento legado.

## Validação

- Teste de recuperação com cache concluído depois do deadline.
- Teste de upgrade parcial e compatibilidade sem contexto.
- Suíte integral `npm run verify`.
- Validação cruzada dos campos enviados pelo APK e da renderização de posição acionária.

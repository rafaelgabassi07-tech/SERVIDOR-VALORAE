# Checkpoint 353 — Requisitos críticos imutáveis do modal

**Proxy público:** `21.12.353`  
**Patch:** `21.12.353-asset-modal-required-sections-hardening-v321`  
**APK pareado:** v500 / `2026.07.12.02`

## Correção

O runtime confundia campos de direcionamento (`missingSections`, `knownMissingSections`, `deferredSections`) com requisitos de entrega. Uma seção opcional podia tornar o contrato permanentemente retryable; no sentido oposto, um `requiredSections` estreito podia reduzir a obrigação do modal.

Agora o conjunto crítico é fixo por família:

- Ação: histórico, receitas/lucros, lucro/cotação, patrimônio, comparação e comunicados.
- FII: histórico, patrimônio, comparação e comunicados.

Os parâmetros de recovery continuam escolhendo quais produtores executar, sem alterar a definição de completude.

## Validação

O teste v321 comprova contrato imutável, ausência opcional não bloqueante, seção crítica ausente ainda retryable e marcadores cross-stack do APK v500.

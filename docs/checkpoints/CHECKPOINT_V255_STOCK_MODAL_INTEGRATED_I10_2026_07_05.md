# Checkpoint v255 — Auditoria integrada do modal de ações

## Objetivo
Consolidar os seis checkpoints críticos do modal de ação com diagnóstico explícito de disponibilidade por seção.

## Blocos cobertos
- Balanço Patrimonial
- Regiões onde gera receita
- Negócios que geram receita
- Dados sobre a empresa
- Informações sobre a empresa
- Posição acionária

## Resultado
O contrato `26.asset-modal.stock.v36` inclui `sectionReadiness`, preenchido apenas a partir de payloads reais capturados do Investidor10. Se uma seção não tiver dados reais suficientes, ela permanece indisponível no APK e o diagnóstico lista o bloco em `missing`, sem fallback estático.

## Validação
- `node test/stock-modal-integrated-sections-i10-v255.test.js`
- `npm run verify`

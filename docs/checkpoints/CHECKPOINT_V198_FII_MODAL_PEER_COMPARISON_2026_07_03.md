# Checkpoint v198 — Comparando com outros FIIs no modal único

Data: 2026-07-03

## Escopo

Evolui o endpoint `/api/v1/asset/fii-modal` para o contrato `26.asset-modal.fii.v6`, adicionando ao modal único de FIIs o bloco **Comparando com outros FIIs** conforme a referência visual enviada do Investidor10 para GGRC11.

## Implementações

- Novo bloco `peerComparison` no contrato do modal de FII.
- Extração da tabela do Investidor10 a partir da seção **COMPARANDO COM OUTROS FIIS**.
- Colunas entregues ao APK:
  - FII
  - Dividend Yield
  - P/VP
  - Valor Patrimonial
  - Tipo
  - Segmento
- Filtro informativo padrão: **Mesmo tipo e segmento**.
- Marcação de destaques por métrica:
  - maior Dividend Yield;
  - menor P/VP válido;
  - maior Valor Patrimonial.
- Ticker do ativo aberto marcado como referência (`isReference=true`).

## Política de fonte

- Dados de pares de FIIs: Investidor10.
- Comparação com índices: Yahoo Finance Chart API direto para IFIX.SA, IDIV.SA e SMLL.SA.
- StatusInvest, Fundamentus e fallbacks legados permanecem bloqueados no modal único.

## Validação

- `node --check lib/analysis/fii-modal-contract.js`
- `node test/fii-modal-peer-comparison-v198.test.js`
- `npm run check:syntax`
- `npm run audit:version`

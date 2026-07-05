# Checkpoint v247 — Posição Acionária de ações via Investidor10

Data: 2026-07-05  
Patch: `21.12.276-stock-shareholding-i10-v247`  
Contrato de ação: `26.asset-modal.stock.v28`

## Escopo

- Remover o bloco **Histórico de Indicadores Fundamentalistas** do modal de ação.
- Corrigir **Posição Acionária** para ações usando dados reais do Investidor10.

## Integridade

- Sem PETR4 fixo.
- Sem GGRC11 fixo.
- Sem mock em produção.
- Sem simulação.
- Se a fonte real não entregar a posição acionária, o bloco retorna `EMPTY`.

## Validação

- `node --check lib/analysis/stock-modal-contract.js`
- `npm run check:syntax`
- `node test/stock-modal-shareholding-i10-v247.test.js`
- `npm test`
- `npm run audit:version`

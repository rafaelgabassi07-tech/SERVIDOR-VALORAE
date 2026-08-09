# Datas de proventos na Análise e modal — v159

Release: `21.12.189-dividend-dates-analysis-modal-v159`
Data: 2026-07-01

## Causa investigada

Algumas fontes entregavam séries de proventos com `label` genérico (`Mensal`, `Anual`, `Total`) e o período real em campos como `period`, `month`, `competence`, `paymentDate` ou `referenceDate`. O contrato anterior aceitava o label genérico primeiro, fazendo gráficos/tooltips perderem mês/ano e o histórico ficar pobre de datas.

## Correção

- Extração de datas passa a aceitar campos equivalentes em português e inglês.
- `chartPoint` prioriza datas/períodos reais antes de labels genéricos.
- Histórico de proventos expõe pagamento, Data COM e competência quando disponíveis.
- Ordenação usa chave cronológica normalizada.

## Validação

- `npm run build` OK.
- `node --check lib/analysis/analysis-page-response.js` OK.

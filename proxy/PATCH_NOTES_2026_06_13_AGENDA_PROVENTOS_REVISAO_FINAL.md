# Agenda e Proventos - revisão final do contrato Proxy

## Ajustes

- Eventos enriquecidos passam a preservar `eligibilityDate` e `comDate` normalizados.
- `portfolioUpcoming`, `portfolioAgenda` e `upcoming` não incluem mais eventos em que a data-com é conhecida e a carteira não era elegível.
- `officialUpcomingEvents` continua mantendo os eventos oficiais para auditoria/diagnóstico, permitindo que o APK decida o que exibir como confirmado ou a confirmar.
- Mantida a política de fonte: StatusInvest como fonte primária por ativo e Investidor10 como complemento de calendário, sem duplicidade.
- Adicionado teste `dividend-ineligible-filter.test.js` para impedir regressão em eventos futuros inelegíveis.

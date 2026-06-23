# v108 — Agenda COM/EX/Pagamento robusta

- Data COM explícita não é mais preenchida com Data EX.
- Data EX é preservada como campo próprio.
- Quando o Proxy inferir a Data COM a partir da Data EX, envia `inferredComDate` e `eligibilityDateSource`.
- Compatibilidade mantida com payloads antigos, sem apagar `paymentDate`.

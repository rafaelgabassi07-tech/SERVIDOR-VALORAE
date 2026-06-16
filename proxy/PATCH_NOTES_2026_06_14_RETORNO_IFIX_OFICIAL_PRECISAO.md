# PATCH NOTES — 2026-06-14 — Retorno com IFIX oficial e precisão reforçada

## APK
- O modal Retorno mantém os cards, gráfico comparativo, tabela mensal e destaques já implementados.
- A linha IFIX só aparece quando o Proxy fornece dados reais do IFIX oficial; o app não desenha linha vazia nem usa proxy.
- Adicionado aviso no gráfico quando o IFIX oficial está indisponível: nenhum ETF/ticker falso é usado.
- O gráfico recebeu preenchimento visual sob a linha da carteira para aproximar o visual da referência.
- `versionCode` e `versionName` mantidos em 26061314 / 2026.06.13.3.

## Proxy
- Adicionado leitor oficial B3 para IFIX: `indexStatisticsPage/daily-evolution/IFIX`.
- Removido uso de `XFIX11`/`IFIX_PROXY` como substituto de IFIX nos contratos de retorno e histórico.
- O contrato `/api/v1/portfolio/returns` agora rebaseia a série ao período selecionado.
- Rentabilidade mensal reforçada com ajuste por aportes, vendas e proventos do mês.
- Diagnóstico informa quando IFIX oficial B3 não está disponível e confirma que nenhum proxy/ETF foi usado.

## Segurança de integração
- Agenda, Proventos, Equilíbrio, Ranking e Sync não tiveram seus contratos alterados.

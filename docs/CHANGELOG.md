# v178 — Auditoria Investidor10, lacunas de FIIs e notificações APK

Core version: 21.12.0  
Public version: 21.12.208  
Patch: `21.12.208-investidor10-gap-news-copy-audit-v178`

## Correções

- Proxy revisado contra páginas reais do Investidor10 de ação e FII para identificar blocos visíveis que não chegavam bem ao APK.
- Adicionada captura de breve apresentação do ativo: `assetPresentation`, `profilePresentation`, `description`, `sobre` e aliases compatíveis.
- Alinhado `applyApiExtrasToResults`, `assetChartBundle`, `AnalysisPageResponse` e `mobile-scraper-contract` para propagar a apresentação do ativo.
- Corrigido contrato dos gráficos financeiros com mais de duas informações: `revenue_profit` agora pode carregar receita líquida, lucro bruto, EBITDA, EBIT e lucro líquido.
- Corrigido `equity_evolution` para carregar patrimônio líquido, ativos e passivos quando disponíveis.
- Demonstrativos financeiros por período ampliados para até 5 séries alinhadas.
- Mantidas as correções do v175 para ETFs, units e BDRs.

## Testes

- Testes regressivos de contrato e lacunas do Investidor10 cobrem apresentação de ação, apresentação de FII e gráficos multi-série.
- `npm run verify` deve executar build, sintaxe, testes e auditoria de versão.

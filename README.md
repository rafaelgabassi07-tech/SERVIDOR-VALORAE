# VALORAE Proxy — v178

Core version: 21.12.0  
Public version: 21.12.208  
Patch: `21.12.208-investidor10-gap-news-copy-audit-v178`  
Checkpoint: `investidor10-gap-news-copy-audit-v178`

## v178 — Auditoria Investidor10, lacunas de FIIs e notificações APK

Correções aplicadas:

- Varredura das páginas do Investidor10 para ação e FII, alinhando o contrato do Proxy aos blocos visíveis de cotação, rentabilidade, histórico de indicadores, dividendos/proventos, comparadores, dados cadastrais, receitas/lucros, lucro x cotação, evolução patrimonial e balanço.
- Captura canônica de breve apresentação do ativo a partir do bloco `SOBRE A EMPRESA` ou dos campos reais de `INFORMAÇÕES SOBRE` no caso de FIIs.
- `assetChartsCanonical`, `assetChartBundle`, contrato `/analysis` e contrato mobile compatível agora carregam `profilePresentation`/`assetPresentation`/`sobre`.
- Gráficos financeiros do contrato do APK passaram a preservar múltiplas séries quando a fonte expõe mais de duas informações: receita líquida, lucro bruto, EBITDA, EBIT e lucro líquido.
- Evolução patrimonial passou a aceitar patrimônio líquido, ativos e passivos no mesmo gráfico multi-série.
- Demonstrativos por período agora podem transportar até 5 séries alinhadas em vez de cortar em 3.
- Testes regressivos de contrato e lacunas do Investidor10 cobrindo apresentação de ação, apresentação de FII e gráficos multi-série.

Validação esperada:

- `npm run verify`
- ZIP sem pasta wrapper, pronto para AI Studio.

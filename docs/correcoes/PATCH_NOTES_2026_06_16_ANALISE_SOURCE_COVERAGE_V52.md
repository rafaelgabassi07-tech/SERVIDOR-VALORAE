# Patch Notes — Análise Source Coverage v52

Patch: `21.12.135-analysis-source-coverage-v52`

## Objetivo

Ampliar a cobertura real da página Análise com base nas páginas de ações e FIIs do Investidor10 e StatusInvest, sem transformar a tela mobile em painel técnico para usuário final.

## Entregas

- Ações: inclusão de PEG Ratio e reforço do roteamento de indicadores/histórico.
- FIIs: inclusão de patrimônio e contábil, imóveis por estado, lista de imóveis, vacância/inadimplência quando disponível, distribuição de ativos e comparação de FIIs.
- Contrato: novas seções `fii_accounting` e `fii_portfolio`.
- APK: página Análise passa a consumir essas seções e deixa pendências técnicas fora da visualização principal.

## Política de dados

Somente dados reais recebidos das fontes ou rotas canonical/sections/results. Sem mock, sem fallback sintético e sem ticker falso.

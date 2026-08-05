# Correção dos gráficos de carteira e patrimônio — Proxy

Data: 2026-08-04

## Escopo

Alinhamento do histórico consolidado entregue ao APK para impedir buckets terminais duplicados e excluir períodos anteriores ao início conhecido da carteira.

## Correções

- Chave temporal canônica para intraday, dia, semana ISO e mês.
- O ponto vivo substitui o fechamento do mesmo bucket em vez de criar um segundo ponto.
- Cálculo defensivo da primeira aquisição conhecida a partir de transações e metadados das posições.
- Quando existe posição de abertura sem origem conhecida, o Proxy não inventa uma data de início nem corta o histórico de forma especulativa.
- Filtro de vida útil aplicado pelo fim do bucket, preservando o mês ou semana em que ocorreu a primeira compra.
- Metadados `portfolioInceptionTimestamp` e `portfolioInceptionDate` incluídos na resposta.

## Validação

- Teste `portfolio-chart-bucket-lifetime-v409.test.js`: aprovado.
- Build Vercel: aprovado.
- Sintaxe de 422 arquivos JavaScript: aprovada.
- Runtime: 152/152 módulos alcançáveis.
- Suíte: 167 aprovados, 100 bloqueados por `cheerio`/`undici`, 0 falhas.
- Consistência de versão: aprovada.

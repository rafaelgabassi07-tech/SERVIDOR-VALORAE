# PATCH 2026-06-14 — Modal Retorno integrado ao Proxy

## APK
- O atalho "Retorno" deixou de usar placeholder de IPCA+ e passou a abrir um modal próprio de rentabilidade.
- Adicionado consumo do contrato `POST /api/v1/portfolio/returns`.
- O modal recebeu cards de Rentabilidade total, Últimos 12 meses, Último mês e Média mensal.
- Adicionado gráfico de linha para comparar carteira com CDI, IPCA, IBOV e IFIX.
- Adicionada tabela mensal de rentabilidade por ano e mês.
- Adicionadas leituras rápidas: melhor mês, pior mês, média mensal e volatilidade mensal.
- Os filtros de período e tipo de ativo foram preparados para solicitar o contrato correto ao Proxy.
- O modal mantém fallback local simplificado quando o Proxy ainda não possui histórico suficiente.

## Proxy
- Criado o contrato `POST /api/v1/portfolio/returns`.
- O Proxy consolida histórico real da carteira, transações, proventos recebidos e benchmarks.
- O contrato retorna `summary`, `series`, `monthlyTable`, `benchmarks`, `highlights` e `diagnostics`.
- CDI, IPCA, IBOV e IFIX foram integrados como referências, com tolerância a falhas parciais.
- Adicionado teste `portfolio-returns-contract.test.js` para validar a estrutura do contrato.

## Versão
- `versionCode` e `versionName` foram mantidos sem alteração.

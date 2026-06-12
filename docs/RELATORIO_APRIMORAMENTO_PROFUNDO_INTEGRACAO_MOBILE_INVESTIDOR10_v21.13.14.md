# Relatório de aprimoramento profundo — integração mobile Investidor10 v21.13.14

## Objetivo

Continuar o fortalecimento do Valorae Proxy para integração simples com APK Android, com foco em estabilidade de contrato, fidelidade dos gráficos expostos pelo Investidor10 e baixa fragilidade contra pequenas mudanças de formato nos dados.

## Principais correções desta rodada

1. **Números financeiros com escala real**
   - Valores como `15,71 Bilhões`, `210,45 Bilhões` e `2,30 Trilhões` agora são convertidos para números absolutos coerentes nos gráficos financeiros.
   - Isso evita gráficos com escala falsa, como lucro de `15,71` quando deveria representar bilhões.

2. **Comparação segura para o APK**
   - A tabela `comparacao` agora entrega métricas em texto estável.
   - Isso protege a interface mobile contra erros ao chamar métodos de string em campos numéricos.

3. **Aliases de contrato para integração mais fácil**
   - Mantidos os nomes esperados pelo APK atual em snake_case.
   - Acrescentados aliases camelCase para integrações futuras sem duplicar lógica no app:
     - `chartsFinanceiros`
     - `historicoIndicadores`
     - `revenueGeography`
     - `revenueSegment`
     - `comparacaoIndices`
     - `distribuicoes12m`
     - `dividendYieldHistory`
     - `dividendHistory`
     - `distribuicaoAtivosFundo`

4. **FIIs com imóveis físicos mais compatíveis com a UI**
   - Cada item de `imoveis` agora preserva `area_bruta_locavel` e também entrega o alias `abl`, que é o campo lido pela interface mobile.

5. **Formatos alternativos de gráficos**
   - `receitas_lucros`, `lucro_cotacao`, `evolucao_patrimonio` e `payout` agora aceitam objetos e arrays.
   - Quebras por mudança de estrutura ficam menos prováveis.

6. **Receita por segmento/geografia no formato Highcharts-like**
   - O Proxy agora converte payloads com `categories` + `series` para o mapa por ano exigido pela interface.

7. **Classificação ampliada de classes negociadas**
   - URLs de `/etfs/`, `/bdrs/`, `/stocks/`, `/reits/` e `/fiagros/` agora são interpretadas explicitamente.
   - Para o APK atual, `tipo_ativo` continua limitado a `acao` ou `fii`, enquanto `classe_ativo` preserva a classificação mais específica.

## Contrato mobile atual

Versão do contrato:

```txt
21.13.14-mobile-deep-hardening-contract
```

Campos principais preservados:

```txt
ticker
symbol
nome
nome_longo
tipo_ativo
classe_ativo
preco_atual
dy
pvp
pl
roe
rentabilidade_chart
revenue_geography
revenue_segment
charts_financeiros
comparacao
comparacao_indices
historico_indicadores
distribuicoes_12m
dividend_yield_history
dividend_history
distribuicao_ativos_fundo
imoveis
_coverage
_source_integrity
```

## Política mantida

O Proxy continua sem inventar gráficos. Quando o ativo não expõe determinado bloco na origem, o campo permanece vazio, nulo ou com contagem zero em `_coverage`.

## Arquivos alterados

```txt
lib/compat/mobile-scraper-contract.js
routes/compat/scraper4.js
test/mobile-deep-hardening-v21-13-14.test.js
docs/RELATORIO_APRIMORAMENTO_PROFUNDO_INTEGRACAO_MOBILE_INVESTIDOR10_v21.13.14.md
```

## Validação

```txt
npm test               -> 112 test files; failures=0
npm run check          -> Checked 351 JS files
npm run typecheck      -> OK
npm run audit:identity -> 0 ocorrências externas
npm run smoke          -> OK
npm run audit:version  -> OK
```

# Relatório de aprimoramento de resiliência do contrato mobile Investidor10 — v21.13.13

## Objetivo

Continuar o endurecimento do Valorae Proxy para integração simples com APK Android, reduzindo fragilidade por pequenas mudanças de campos, nomes de chaves, formatos de datas, estruturas de gráficos e classificação de ativos.

## Pontos corrigidos nesta rodada

### 1. Classificação menos frágil de ativos terminados em 11

Antes, o contrato mobile ainda podia depender demais do sufixo `11` para inferir FII. Nesta versão foi criada uma separação entre:

- `tipo_ativo`: continua compatível com o APK atual, usando `acao` ou `fii`.
- `classe_ativo`: informa a classe mais específica quando detectável, como `acao`, `fii`, `fiagro`, `etf` ou `bdr`.

Isso evita que units e ETFs sejam tratados como FII apenas pelo ticker terminar em `11`, sem quebrar a lógica atual do APK.

### 2. Rota compatível mais tolerante a entradas diferentes

A rota de fundamentos agora aceita ticker vindo em formas mais variadas, incluindo:

- ticker direto;
- URL de ações, FIIs, ETFs ou BDRs;
- query string com `ticker`, `symbol`, `ativo`, `codigo` ou `papel`;
- texto livre contendo um ticker B3 válido.

A rota também usa a URL ou o tipo explícito informado no payload para escolher o caminho correto de busca, em vez de depender só de heurística por ticker.

### 3. Comparação com índices normalizada

`comparacao_indices` agora é normalizada para uma lista estável de séries:

```json
[
  {
    "label": "HGLG11",
    "points": [
      { "date": "jan/24", "profitability": 0.5 }
    ]
  }
]
```

O gráfico de rentabilidade também reutiliza essa normalização quando a origem vem nesse formato.

### 4. Comparação entre ativos mais resistente

A tabela `comparacao` agora consegue aproveitar fontes que chegam como séries por ticker, não apenas como linhas prontas. Quando a origem vier no formato:

```json
{
  "name": "HGLG11",
  "points": [
    { "label": "DY", "value": "8,41%" },
    { "label": "P/VP", "value": "0,95" }
  ]
}
```

ela é convertida para linha compatível com o APK:

```json
{
  "ticker": "HGLG11",
  "dy": "8,41%",
  "pvp": "0,95"
}
```

### 5. Proventos, DY histórico e distribuições normalizados

Foram adicionados normalizadores para:

- `dividend_history`;
- `dividend_yield_history`;
- `distribuicoes_12m`.

Datas em `dd/mm/aaaa` agora saem como `aaaa-mm-dd` quando possível, e valores como `R$ 1,10` ou `8,41%` são convertidos para número nos campos próprios.

### 6. Cobertura técnica mais explícita

`_coverage.chartBlocks` agora informa contagem para:

- `distribuicoes_12m`;
- `dividend_yield_history`;
- `dividend_history`;
- `comparacao_indices`;
- `comparacao`;
- imóveis/distribuição de ativos.

Isso facilita diagnóstico sem o APK precisar inferir se o bloco veio vazio por erro ou por ausência real na origem.

## Arquivos alterados

- `lib/compat/mobile-scraper-contract.js`
- `routes/compat/scraper4.js`
- `test/mobile-resilient-contract-v21-13-13.test.js`
- `docs/RELATORIO_APRIMORAMENTO_RESILIENCIA_CONTRATO_MOBILE_INVESTIDOR10_v21.13.13.md`

## Validações executadas

```txt
npm test               -> 111 test files; failures=0
npm run check          -> Checked 350 JS files
npm run typecheck      -> OK
npm run audit:identity -> 0 ocorrências externas
npm run smoke          -> OK
npm run audit:version  -> OK
```

## Política mantida

O Proxy não cria dados simulados para gráficos do Investidor10. Quando um ativo não expõe um bloco, o contrato entrega vazio/nulo de forma previsível, preservando o APK contra quebra de renderização sem inventar informação.

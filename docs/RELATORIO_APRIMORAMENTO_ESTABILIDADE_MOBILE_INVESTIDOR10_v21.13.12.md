# Relatório — Aprimoramento de estabilidade mobile para gráficos Investidor10

Versão do contrato mobile: `21.13.12-mobile-stable-investidor10-contract`

## Objetivo

Reduzir fragilidade de integração entre o Proxy e o aplicativo Android, principalmente em pequenos desvios de payload, mudança de ordem dos blocos do Investidor10 ou retorno parcial de APIs internas.

## Correções aplicadas

### 1. Contrato `comparacao` corrigido

O campo `comparacao` agora é reservado apenas para tabela de comparação por ticker, porque a interface mobile espera linhas com campos como `ticker`, `dy`, `pvp`, `patrimonio`, `tipo`, `segmento`, `pl`, `roe` e `val_mercado`.

A comparação de rentabilidade com índices foi separada em `comparacao_indices`, evitando que uma série temporal seja interpretada como tabela horizontal e gere uma seção vazia no app.

### 2. Captura de imóveis em FII de tijolo por HTML

Quando a API interna não entregar a lista de imóveis, o Proxy passa a extrair a seção estática `Lista de Imóveis` do HTML do Investidor10, com:

- `nome`
- `estado`
- `area_bruta_locavel`
- `tipo`
- `source`

Isso melhora a robustez para FIIs de tijolo que expõem imóveis diretamente na página.

### 3. Fallback de distribuição de ativos em FII de papel/híbrido

Quando existir a seção `distribuição de ativos do fundo`, o Proxy tenta normalizar os itens percentuais como `distribuicao_ativos_fundo`. Se não houver valores no HTML estático, ele não inventa dados.

### 4. Compatibilidade com campos de entrada alternativos

A rota `/api/scraper` aceita ticker por:

- `ticker`
- `symbol`
- `ativo`
- `codigo`
- `code`
- `papel`
- `slug`
- URL do Investidor10

Isso reduz quebra por pequenas variações no cliente Android.

### 5. Campos usados pela interface mobile

O contrato agora preserva também:

- `nome_longo`
- `advanced_metrics`
- `comparacao_indices`
- `_source_integrity`

### 6. Sanitização do contrato

Antes de responder ao APK, o Proxy remove valores perigosos para JSON/Chart.js, como `NaN` e `Infinity`, sem criar séries falsas.

## Arquivos alterados

- `lib/market/investidor10-chart-extractor.js`
- `lib/compat/mobile-scraper-contract.js`
- `routes/compat/scraper4.js`
- `lib/Valorae-engine.js`
- `test/mobile-stable-investidor10-contract-v21-13-12.test.js`

## Garantias de fidelidade

- O Proxy não cria dados sintéticos de gráfico.
- Bloco ausente na origem vira array vazio, objeto vazio ou `null`, conforme o contrato esperado.
- `comparacao` não recebe mais séries de índices.
- `comparacao_indices` mantém as séries de índices de forma separada.
- FIIs de tijolo priorizam imóveis físicos.
- FIIs de papel/híbrido priorizam distribuição de ativos do fundo quando disponível.

## Validação adicionada

Novo teste unitário: `test/mobile-stable-investidor10-contract-v21-13-12.test.js`.

Ele cobre:

- extração HTML de imóveis físicos;
- preservação de `nome_longo` e `advanced_metrics`;
- separação entre `comparacao` e `comparacao_indices`;
- normalização de comparação por ticker;
- remoção de `NaN` e `Infinity`.

### 7. Proteção para units B3 terminadas em 11

Alguns ativos da B3 terminam em `11`, mas não são FIIs. O contrato mobile agora possui uma lista curta de units conhecidas para evitar classificar automaticamente esses tickers como FII quando o tipo não vier explícito no payload.

Essa regra reduz falso positivo em integrações Android que enviam apenas o ticker, sem `type` ou `assetClass`.

### 8. Normalização reforçada de `lucro_cotacao`

O bloco `lucro_cotacao` agora é normalizado mesmo quando a origem vier como objeto por ano, não apenas como array. Isso evita que a interface receba campos com nomes inconsistentes e mantém `net_profit` e `quotation` estáveis.

### 9. Comparação por pares para ações e FIIs

A normalização de `comparacao` aceita tanto comparação de FIIs quanto comparação de ações, desde que a origem seja uma tabela de ativos por ticker. Séries temporais de índices continuam isoladas em `comparacao_indices`.

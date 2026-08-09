# Checkpoint 351 — Recuperação completa dos modais de Ação e FII

**Versão pública:** `21.12.351`  
**Patch:** `21.12.351-asset-modal-section-complete-recovery-v319`  
**APK pareado:** v498  
**Protocolo móvel:** `2026.07.10.10`  
**Asset modal delivery:** v3

## Causas corrigidas

O contrato anterior podia abrir o modal com cotação e métricas básicas enquanto históricos e gráficos financeiros estavam vazios. O producer profundo executava muitas chamadas em um orçamento curto, o cache considerava o grupo de gráficos completo quando apenas um gráfico existia e recuperações repetiam o full inteiro.

## Nova arquitetura

### Snapshots por seção

Cada resposta promove primeiro os blocos válidos para um snapshot incremental. Uma resposta parcial nunca substitui um full estável nem apaga seções já conhecidas.

### Full estrito

Para Ações, o contrato full exige histórico fundamentalista, Receitas e Lucros, Lucro x Cotação e Evolução do Patrimônio. Para FIIs, exige histórico fundamentalista e informações patrimoniais. O cálculo de qualidade trata cada gráfico individualmente.

### Recuperação dirigida

O Proxy interpreta `requiredSections`, `knownMissingSections` e `missingSections`. Em recuperação, só dispara os produtores necessários, reduzindo concorrência, latência e probabilidade de corte por deadline.

### Fallback de Lucro x Cotação

Quando a rota dedicada não responde, o gráfico é montado somente com valores reais: lucro anual vindo dos resultados do Investidor10 e última cotação ajustada anual do Yahoo Finance. A fonte combinada é declarada no payload.

### Histórico de FII

A resolução de `fiiId` usa cache, extração de HTML e alternativas REST. O histórico tenta múltiplas rotas por ID e ticker e aceita apenas conteúdo parseável e não vazio.

### Compatibilidade arquitetural

A auditoria cross-stack agora lê `ValoraeAssetModalDelivery`, `ValoraeAssetModalQuality` e `ValoraeProxyEndpointCatalog` diretamente de `domain/model`, acompanhando a fronteira arquitetural do APK. Isso impede que testes integrados dependam de DTOs duplicados ou de caminhos removidos em `data/proxy`.

## Cache e deadlines

O runtime bloqueia downgrade do full estável, mantém stale como retryable e promove o cache full apenas quando as seções críticas existem. Os producers respeitam o teto serverless defensivo de 12,5 segundos; o APK possui orçamento de rede ligeiramente superior para receber a resposta final sem cancelar o servidor prematuramente.

## Validação

- suíte completa do Proxy;
- build seguro para Vercel;
- testes cross-stack com APK v498;
- regressão v319 de schema, snapshots, cache estrito, recuperação direcionada, fallback Yahoo e resolução de FII.

Nenhum dado financeiro sintético foi introduzido.

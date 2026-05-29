# Auditoria v21.12.37 — Restauração dos filtros da Saída do Proxy

## Contexto

A página **Saída do Proxy** já tinha botões customizados para `Status HTTP`, `Raiz do payload` e `Mais recentes`, mas a reconstrução dinâmica dos menus passou a substituir as opções fixas por apenas valores encontrados no feed atual.

Quando o monitor ainda não tinha tráfego real, ou quando o feed tinha poucos eventos, o resultado visual era uma sensação de filtros removidos: os botões apareciam, mas tinham poucas opções ou somente o placeholder.

## Correção aplicada

- Mantive a correção anterior de escopo do monitor (`state is not defined`).
- Restaurei um catálogo fixo de filtros para os três menus.
- Preservei a descoberta dinâmica de status e raízes vistos no feed.
- A descoberta dinâmica agora **soma** opções ao catálogo base, em vez de substituir tudo.
- O botão `Limpar filtros` também atualiza o texto dos botões customizados.
- `public/index.html` e `public/server.html` permanecem espelhados.
- `lib/Valorae-engine.js` não foi desmembrado nem alterado.

## Novos filtros

### Status HTTP

Inclui famílias e códigos comuns:

- Todos
- 2xx sucesso
- 3xx cache/redireção
- 4xx erro do cliente
- 5xx erro do servidor
- Qualquer erro >= 400
- Parciais / 206
- Cache / 304
- Códigos comuns de 200 a 504
- Códigos adicionais vistos dinamicamente no feed

### Raiz do payload

Inclui grupos e raízes oficiais:

- Contrato app/mobile
- Qualidade / guardrails
- Mercado / financeiro
- Performance / cache / fonte
- appPayload
- appMobileSnapshot
- appSyncEnvelope
- appResponseIntegrity
- chartSeries
- normalized
- results
- quote
- metrics
- indicators
- dividends
- news
- sources
- cache
- fieldConsistencyGuard
- payloadBudget
- assetActionPlan
- assetClassContract
- engineRuntimeProfiler
- engineLaunchGate
- dataQuality
- marketData
- error
- raízes adicionais vistas dinamicamente no feed

### Ordenação

Inclui:

- Mais recentes
- Mais antigos
- Mais bytes
- Menos bytes
- Maior latência
- Menor latência
- Status HTTP maior
- Status HTTP menor
- Rota A-Z
- Ticker A-Z
- App/canal A-Z
- Mais raízes JSON
- Mais pontos de gráfico
- Mais dividendos
- Mais alertas de campos

## Validação

Novo teste adicionado:

```bash
node test/proxy-output-filters-v21-12-37.test.js
```

Esse teste valida:

- presença dos filtros fixos;
- presença das funções de filtragem real;
- catálogo dinâmico sem perda da base;
- espelhamento entre `public/server.html` e `public/index.html`.

## Resultado

A página **Saída do Proxy** voltou a ter filtros completos nos botões principais e continua compatível com a versão de monitor corrigida anteriormente.

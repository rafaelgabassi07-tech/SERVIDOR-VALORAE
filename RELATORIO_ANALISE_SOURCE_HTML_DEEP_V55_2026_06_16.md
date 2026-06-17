# RELATÓRIO — Análise Source HTML Deep v55

Data: 2026-06-16  
Checkpoint: `analysis-source-html-deep-v55`  
Proxy: `21.12.138-analysis-source-html-deep-v55`  
APK: `versionCode = 26061401`, `versionName = 2026.06.14.1` preservados

## Objetivo

Continuar a revisão minuciosa das páginas de Ações e FIIs no Investidor10 e StatusInvest, reforçando a página **Análise** como base futura para os modais de ativos da carteira e do ranking.

A entrega mantém duas regras centrais:

1. Capturar mais informações reais quando a fonte fornece.
2. Não poluir a página de Análise com diagnóstico técnico ou dado inútil para o usuário final.

## Revisão das fontes

### Ações — Investidor10

Foram considerados blocos como:

- Preço Justo de Graham.
- Indicadores fundamentalistas.
- Comparativos por setor, subsetor e segmento.
- Histórico de indicadores.
- Checklist buy and hold.
- Histórico de dividendos.

### FIIs — Investidor10

Foram considerados blocos como:

- Informações sobre o fundo.
- Razão social e CNPJ.
- Público-alvo.
- Mandato.
- Segmento.
- Tipo de fundo.
- Prazo de duração.
- Tipo de gestão.
- Taxa de administração.
- Vacância.
- Número de cotistas.
- Cotas emitidas.
- Valor patrimonial por cota.
- Valor patrimonial.
- Último rendimento.
- Histórico de indicadores.
- Comparativos.
- Informações adicionais.
- Lista de imóveis.

### Ações — StatusInvest

Foram reforçados dados como:

- Valor atual.
- Mínima/máxima de 52 semanas.
- Mínima/máxima do mês.
- Dividend Yield.
- Valorização em 12 meses.
- Variação do mês atual.
- Volatilidade histórica.
- Tipo da ação.
- Tag Along.
- Liquidez média diária.
- Participação no IBOV.
- Mercado de opções.
- Aluguel de ações: data base, tomador, doador e faixas mínima/máxima.

### FIIs — StatusInvest

Foram reforçados dados como:

- Abas e grupos: Indicadores, Geral, Contábil, Portfólio e Comunicados.
- Valor atual.
- Mínima/máxima de 52 semanas.
- Mínima/máxima do mês.
- Dividend Yield.
- Últimos rendimentos.
- Valorização em 12 meses.
- Valor patrimonial por cota.
- Patrimônio.
- P/VP.
- Valor de mercado.
- Valor em caixa.
- DY CAGR.
- Valor CAGR.
- Número de cotistas.
- Número de cotas.
- Rendimento médio 24M.
- Liquidez média diária.
- Participação no IFIX.
- Negociações.
- Resultado/contábil ampliado.
- Portfólio físico.
- Eventos e comunicados.

## Ajustes realizados no Proxy

### 1. Leitura profunda do HTML de ações no StatusInvest

Adicionado suporte para capturar:

- `Min. 52 semanas`.
- `Máx. 52 semanas`.
- `Min. mês`.
- `Máx. mês`.
- `Valorização (12m)`.
- `Mês atual`.
- `Tipo`.
- `Tag Along`.
- `Liq. méd. diária`.
- `PART. IBOV`.
- `MERCADO DE OPÇÕES`.

Também foi corrigido o tratamento de campos textuais como **Tipo** e **Mercado de opções**, evitando que o parser capture valores monetários/percentuais vizinhos de forma errada.

### 2. Aluguel de ações

Foi criada extração dedicada para o bloco de aluguel de ações do StatusInvest:

- Data base.
- Tomador média.
- Faixa tomador.
- Doador média.
- Faixa doador.

### 3. Rendimento atual de FIIs no StatusInvest

Foi adicionada extração dedicada para:

- Último rendimento.
- Rendimento percentual do último pagamento.
- Cotação base.
- Data base.
- Data de pagamento.
- Rendimentos do ano passado.
- Rendimentos do ano atual.

### 4. Cadastro detalhado de FIIs no Investidor10

Foi criada extração para o bloco **Informações sobre o FII**, incluindo:

- Razão social.
- CNPJ.
- Público-alvo.
- Mandato.
- Segmento.
- Tipo de fundo.
- Prazo de duração.
- Tipo de gestão.
- Taxa de administração.
- Vacância.
- Número de cotistas.
- Cotas emitidas.
- Valor patrimonial por cota.
- Valor patrimonial.
- Último rendimento.

### 5. Eventos e comunicados

Foi adicionada leitura para eventos/comunicados do StatusInvest, filtrando mensagens vazias como “não há eventos para este dia”.

### 6. Tecnologias de extração suportadas

O Proxy agora sinaliza internamente suporte para:

- HTML textual.
- Tabelas HTML.
- JSON-LD.
- `__NEXT_DATA__`.
- Nuxt payload.
- Atributos `data-*`.
- Literais JSON inline seguros.
- Estados de bibliotecas de gráficos como Highcharts, ApexCharts, Chart.js e ECharts.
- Rotas internas descobertas no HTML.
- Scripts vinculados para inspeção de caminhos de dados.

Esses diagnósticos não são exibidos para o usuário final na página Análise.

## Ajustes realizados no APK

- Changelog sincronizado em tempo real com o checkpoint v55.
- Metadata do APK atualizada para indicar a Análise como base futura dos modais de ativos.
- Descrição da seção `governance_events` ajustada para linguagem de usuário final.
- Categoria principal mantém dados úteis agrupados de forma limpa e recolhível.

## Garantias mantidas

- Sem dados simulados.
- Sem ticker falso.
- Sem `eval`.
- Sem WebView para raspar página dentro do APK.
- Sem exibição de diagnósticos técnicos na tela principal.
- Sem alteração de `versionCode` e `versionName`.

## Validações executadas

### Proxy

- `npm run check` — OK, 235 arquivos JS checados.
- `npm test` — OK, 52 arquivos de teste, 0 falhas.
- `npm run verify` — OK.
- `npm run audit:version` — OK.
- `npm run audit:identity` — OK, 0 ocorrências externas.
- `npm run smoke` — OK.

### APK

- JSON de changelog/versão/update validado.
- `versionCode = 26061401` preservado.
- `versionName = 2026.06.14.1` preservado.
- Build Android completo não executado neste ambiente porque o pacote não inclui `gradlew` e não há SDK/Gradle Android disponível.

## Observação de robustez

A extração foi ampliada para múltiplos caminhos e tecnologias, reduzindo fragilidade contra pequenas mudanças de HTML. Ainda assim, não é correto prometer extração perfeita permanente, porque Investidor10 e StatusInvest podem alterar marcação, endpoints ou mecanismos de bloqueio. A proteção correta é manter múltiplas rotas de leitura, testes regressivos e diagnóstico interno sem poluir a UI.

# VALORAE v540 — Notificações editoriais e fontes visuais

Data da auditoria: 25/07/2026

## Escopo

Auditoria e implementação no APK e no V-Proxy para padronizar títulos e textos, tornar a atualização do aplicativo uma notificação Android real, identificar visualmente a publicação responsável pelas notícias e reduzir repetição ou ruído.

## Contrato de versão

- APK: v540 / `2026.07.25.03` / versionCode `26072503`
- Proxy: `21.12.394-runtime-safety-v362`
- Monitor: v364
- Protocolo móvel: `2026.07.10.10`
- Asset modal delivery: v4

## Notificações Android após a revisão

### Concentração

Título:

`PETR4 concentra 42,7% da carteira`

Texto:

`O ativo está acima do limite de 35%. Revise a distribuição da carteira.`

O mesmo ativo não volta a notificar diariamente no mesmo nível. Uma nova notificação ocorre quando a faixa muda entre elevada, alta e crítica.

### Provento recebido

Título:

`R$ 110,00 em proventos de HGLG11`

Texto:

`Pagamento de R$ 1,10 por cota registrado hoje • Rendimento.`

Quando o valor total não estiver disponível, o título usa `Provento de HGLG11 recebido`.

### Pagamento futuro

Título:

`HGLG11 paga proventos amanhã`

ou

`Provento de HGLG11 em 5 dias`

Texto:

`Previsão de R$ 110,00 • R$ 1,10 por cota • 30/07/2026.`

### Data COM

Título:

`Último dia para receber proventos de BBAS3`

ou

`Data COM de BBAS3 em 7 dias`

Texto:

`Elegibilidade em 01/08/2026 • R$ 0,42 por cota • pagamento previsto para 15/08/2026.`

### Notícia da carteira

O título prioriza o título real da matéria quando ele já identifica o ativo. Nos fallbacks editoriais, usa formas como:

- `PETR4 publica comunicado oficial`
- `PETR4 anuncia proventos`
- `PETR4 divulga resultado`
- `PETR4 anuncia recompra de ações`
- `Rating de PETR4 foi atualizado`
- `Novidade relevante sobre PETR4`

O texto usa o resumo da matéria, sem repetir ticker, fonte ou a frase “Toque para abrir”.

Ações:

- `Ler notícia`
- `Marcar como lida`

### Fechamento diário

Título dinâmico:

- `Sua carteira fechou em alta de 1,34%`
- `Sua carteira fechou em queda de 0,82%`
- `Sua carteira encerrou o dia estável`

Texto:

`Resultado do dia: +R$ 248,90 • patrimônio de R$ 18.820,00.`

A imagem expandida mostra até seis ativos, barras positivas acima da linha zero, negativas abaixo, maior alta e maior queda.

### Atualização do VALORAE

Título:

`VALORAE 2026.07.25.03 disponível`

Texto:

Usa até dois destaques reais do changelog. Em atualização obrigatória, informa segurança e compatibilidade.

Ação:

`Ver novidades`

### Teste

Título:

`Notificações estão funcionando`

Texto:

`Este aparelho já pode receber alertas do VALORAE.`

### Agrupamento

Título:

`3 novidades na sua carteira`

O resumo exibe os títulos individuais. A palavra “alerta” fica reservada a eventos de risco.

## Logotipo e imagem das notícias

A composição implementada segue o comportamento nativo do Android:

- smallIcon: símbolo monocromático próprio do VALORAE;
- largeIcon: logotipo da publicação;
- BigPicture: imagem da matéria, quando a fonte fornece uma URL válida;
- fallback: texto completo, sem impedir a entrega.

O Proxy retorna aliases compatíveis de `sourceLogoUrl` e `articleImageUrl`. O favicon da publicação é solicitado em 128 px quando a fonte não fornece logotipo próprio.

## Segurança e desempenho da mídia

- Somente URLs HTTPS.
- Hosts locais e redes privadas são rejeitados.
- Limite de 2,5 MB por imagem.
- Timeouts curtos e sem repetição automática de download.
- Logos em até 144 × 144.
- Matérias em até 900 × 480.
- Decodificação RGB_565 e redução por amostragem.
- Cache temporário: logos por 7 dias, imagens por 18 horas.
- No máximo 24 arquivos no cache.
- Falha de imagem nunca cancela a notificação.

## Deduplicação e ruído

- No máximo uma notícia por ciclo de publicação.
- Notícias semanticamente equivalentes são deduplicadas.
- O total de notificações por ciclo é limitado.
- Eventos de proventos são compactados por ticker, sem misturar empresas diferentes.
- Concentração é reemitida somente quando muda a faixa de risco.
- O histórico completo permanece na Central do aplicativo.

## Arquivos principais alterados

### APK

- `ValoraeNotificationCenter.kt`
- `ValoraeNotificationWorker.kt`
- `ValoraeNotificationModels.kt`
- `ValoraeProxyJsonHelpers.kt`
- `ValoraeProxyRankingModels.kt`
- `PortfolioNewsScreenUi.kt`
- `PortfolioNotificationCenterScreenUi.kt`
- `SettingsPages.kt`
- `ic_notification_valorae.xml`

### Proxy

- `lib/sources/news.js`
- `metadata.json`
- `package.json`
- testes de contrato APK/Proxy e branding visual

## Validação

APK:

- 217 arquivos Kotlin com estrutura e delimitadores validados.
- Auditoria funcional das páginas: 27/27.
- Auditoria de notificações em segundo plano aprovada.
- Contrato de fechamento diário aprovado.
- Contrato editorial/mídia aprovado.
- Metadados de release alinhados em v540.
- Room 12→13, sincronização e proteção de recursos do Supabase aprovados.

Proxy:

- Build Vercel aprovado.
- Verificação sintática em 503 arquivos JavaScript.
- Auditoria de versão aprovada.
- Auditoria de alcance do runtime aprovada.
- Testes direcionados de notícias, branding, protocolo e alinhamento completo aprovados quando não dependem de pacotes ausentes.

## Limitações do ambiente

A compilação Android não iniciou porque o Gradle Wrapper exige a distribuição Gradle 8.10.2, não armazenada localmente, e o ambiente não consegue resolver `services.gradle.org`.

A suíte integral do Proxy não concluiu dentro do limite do ambiente; um teste que importa o motor completo também ficou bloqueado pela ausência local de `cheerio`. Build, sintaxe, versões, alcance, testes de protocolo e os testes direcionados do recurso foram aprovados.

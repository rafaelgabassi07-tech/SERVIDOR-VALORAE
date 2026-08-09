# VALORAE — Auditoria completa APK v538 e V-Proxy v362

Data: 25/07/2026

## Resultado

O APK e o Proxy foram auditados em conjunto e corrigidos para operar com o mesmo contrato, versões, rotas, métodos HTTP, políticas de cache, sincronização financeira e comportamento de monitoramento. O monitor foi redesenhado como uma central operacional limpa, responsiva e organizada por páginas dedicadas.

## Incompatibilidades corrigidas

- O Proxy ainda declarava pareamento com o APK v534 (`2026.07.23.05`), enquanto o APK enviado estava na linha v537. O par atual foi consolidado como APK v538 (`2026.07.25.01`) + Proxy público `21.12.394` + monitor v366.
- Metadados, manifesto, service worker, `package.json`, Gradle, arquivos de atualização e changelog foram alinhados.
- O manifesto PWA voltou a usar a versão pública canônica `21.12.394`, mantendo `monitor_version: v366` em campo próprio.
- TTLs foram equalizados: cotações 120 s; notícias, rankings e agenda 900 s; histórico e retornos da carteira 300 s.
- Dezesseis chamadas diretas GET/POST encontradas no APK foram comparadas ao manifesto real do roteador do Proxy. Nenhuma rota ou método ficou ausente.
- Testes antigos que ainda presumiam tela monolítica ou versões v534/v537 foram atualizados para a arquitetura modular e para o contrato atual.
- A busca de ativos em subpáginas da Análise abre o modal compartilhado sem sobrescrever a barra de pesquisa principal (`updateMainSearch = false`).

## Monitor profissional v366

O monitor deixou de concentrar informações técnicas no rodapé e passou a oferecer páginas próprias:

- Visão geral
- Tráfego
- Detalhe dedicado da requisição
- Rotas
- Fontes e cache
- Saúde
- Diagnósticos
- Arquitetura
- Benchmark
- Ajustes

Melhorias principais:

- navegação por `/monitor/*`, com History API e compatibilidade com rotas antigas;
- sidebar persistente no desktop e menu móvel responsivo;
- página dedicada para cada evento, incluindo entrada, consumidor, entrega, qualidade, sinais e payload;
- filtros de tráfego, busca, exportação CSV/JSON e indicadores objetivos;
- atualização automática configurável entre 15 e 120 segundos, padrão 30 segundos;
- pausa de atualização, respeito à aba oculta e prevenção de requisições sobrepostas;
- acessibilidade com skip link, foco, `aria-live`, estados de botões e navegação por teclado;
- visual plano, limpo e sem excesso de gradientes, sombras ou containers decorativos;
- `index.html` e `server.html` mantidos idênticos para evitar divergência entre rotas.

## Supabase e eficiência

- Telemetria do monitor permanece exclusivamente em memória.
- `VALORAE_MONITOR_PERSISTENCE_ENABLED` não ativa leitura ou escrita remota.
- O snapshot operacional não anuncia mais “memória + Supabase” nem histórico persistido.
- Credenciais do Supabase continuam reservadas à autenticação e à sincronização financeira legítima.
- Estado compartilhado remoto permanece desativado por padrão e exige opt-in duplo explícito.
- Backups financeiros integrais permanecem desativados por padrão.

## APK

- Versão consolidada: `versionCode 26072501`, `versionName 2026.07.25.01`.
- Metadados de Patrimônio Total descrevem corretamente o gráfico consolidado com alternância linha/barras.
- A antiga seção separada de alocação por classe permanece removida.
- Checklist preserva o estado lógico sem expor a legenda pública “Não atende” nem a frase de cálculo removida.
- README e validação do checkpoint patrimonial foram atualizados para a arquitetura real.
- Gradle Wrapper preservado como executável.

## Validação do Proxy

- 502 arquivos JavaScript passaram pela verificação sintática.
- Build para Vercel aprovado.
- Auditoria de versões aprovada.
- Auditoria de alcance: 150 de 238 módulos alcançáveis pelo runtime; 88 módulos standalone documentados e validados por allowlist explícita.
- Suíte completa: 267 arquivos de teste; 160 aprovados; 0 falhas; 107 bloqueados somente porque `cheerio` (106) e `undici` (1) não puderam ser instalados neste ambiente.
- A tentativa de `npm ci` não concluiu por indisponibilidade externa e porque o ambiente executa Node 22, enquanto o projeto declara Node 24.

## Validação visual do monitor

Teste em navegador com DOM, CSS, JavaScript e respostas determinísticas:

- cinco métricas e cinco eventos renderizados na visão geral;
- cinco eventos renderizados no tráfego;
- detalhe dedicado aberto como `GET /api/v1/news`;
- páginas Fontes, Saúde, Diagnósticos, Arquitetura, Benchmark e Ajustes renderizadas;
- menu móvel abriu corretamente;
- nenhum erro de runtime, console ou página.

Durante essa validação foram corrigidos dois defeitos reais de CSS: controles de menu aparecendo indevidamente no desktop e estado vazio sobrepondo o conteúdo de detalhe.

## Validação do APK

- Estrutura essencial e Gradle Wrapper íntegros.
- Metadados, Gradle, arquivos de atualização e changelog alinhados.
- 217 arquivos Kotlin com delimitadores balanceados e sem padrões conhecidos de risco de compilação.
- Validador estrutural integral aprovado.
- Checkpoint de Patrimônio Total, CDI, risco e performance aprovado.

## Limitação real

A compilação Android não iniciou porque o Gradle Wrapper precisa baixar o Gradle 8.10.2 e o ambiente não conseguiu resolver `services.gradle.org`. Portanto, a entrega contém o projeto-fonte corrigido, não um APK binário compilado. A falha ocorreu antes da compilação do código Kotlin.

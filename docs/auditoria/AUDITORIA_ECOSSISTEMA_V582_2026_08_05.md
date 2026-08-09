# Auditoria minuciosa do ecossistema VALORAE

**Data:** 5 de agosto de 2026  
**APK auditado:** pacote `apk-valorae (42).zip`  
**Release corrigida do APK:** v582 — `2026.08.05.01` (`versionCode 26080501`)  
**Proxy auditado/corrigido:** `21.12.401-ecosystem-maturity-v410`  
**Contrato cruzado:** `valorae-ecosystem-2026.08.05.01-p401`

## 1. Resultado executivo

A auditoria encontrou uma inconsistência crítica entre o que o código continha, o que os testes afirmavam e o que o Android identificava como versão instalada. O pacote recebido ainda era publicado como **v573 / 2026.08.04.01**, embora incorporasse alterações posteriores. Ao mesmo tempo, componentes visuais ativos haviam sido revertidos no próprio código, enquanto testes estruturais continuavam aprovando marcadores isolados. Isso explica por que alterações anunciadas anteriormente não apareciam no aparelho.

A correção amadurece o ecossistema em quatro frentes:

1. **Identidade de release confiável:** APK promovido para v582 e Proxy para 21.12.401.
2. **Árvore visual efetivamente usada:** componentes revertidos foram restaurados nos call sites ativos.
3. **Pareamento verificável APK ↔ Proxy:** todas as requisições e respostas passam a carregar uma identidade explícita do ecossistema.
4. **Validação cruzada real:** versões, contratos, rotas e baselines visuais são comparados entre os dois projetos.

## 2. Achados e correções

### 2.1 Crítico — release recente continuava identificada como v573

**Evidência encontrada**

- `versionCode = 26080401`
- `versionName = 2026.08.04.01`
- metadados, update JSON e arquivos `.env.example` mantinham a identidade antiga.

**Impacto**

- O Android podia não distinguir corretamente a entrega atual de pacotes anteriores.
- O usuário podia instalar uma árvore de código diferente sem perceber mudança de versão.
- A página de atualização e a compatibilidade do Proxy trabalhavam com uma identidade obsoleta.
- Ficava difícil comprovar qual pacote estava realmente instalado.

**Correção**

- APK elevado para `versionCode 26080501` e `versionName 2026.08.05.01`.
- Release nomeada **v582 — Auditoria e amadurecimento do ecossistema**.
- `metadata.json`, `version.json`, `update.json`, changelog, README e ambientes alinhados.
- Proxy elevado para versão pública `21.12.401` e janela máxima testada `2026.08.05.01`.

### 2.2 Alto — mudanças visuais haviam sido revertidas no código ativo

**Evidência encontrada**

- O container interno do gráfico **Patrimônio consolidado** havia sido reintroduzido.
- Ícones haviam voltado aos cabeçalhos de **Conta Valorae** e **Atualização do sistema**.
- A evolução de proventos havia perdido a explicação de início da carteira, eventos excluídos e elegibilidade.
- A composição visual testada não correspondia ao componente entregue.

**Impacto**

- A interface exibida não correspondia ao resultado anunciado.
- Testes baseados apenas na presença de textos ou funções geravam falso positivo.
- O usuário via a aparência antiga mesmo recebendo um ZIP descrito como corrigido.

**Correção**

- Restaurada a composição ativa de `PatrimonyTotalModalComponents.kt`.
- Restaurados os cabeçalhos independentes e limpos de Conta e Atualização.
- Restauradas as informações temporais e de elegibilidade em Proventos.
- Baselines visuais recalculadas sobre os arquivos efetivamente entregues.
- Testes cruzados do Proxy atualizados para proteger os hashes visuais atuais do APK.

### 2.3 Alto — ausência de identidade única entre APK e Proxy

**Situação anterior**

O APK verificava conectividade e versões de protocolo, mas não havia uma assinatura semântica simples que comprovasse que a resposta vinha do Proxy pareado àquela entrega.

**Risco**

- Um host errado, implantação antiga ou ambiente divergente podia responder `200`, parecendo saudável.
- Diagnósticos confundiam “servidor respondeu” com “ecossistema correto respondeu”.
- Trocas de host e failover podiam ocultar uma implantação desatualizada.

**Correção**

Foi criado o contrato:

`valorae-ecosystem-2026.08.05.01-p401`

O APK envia:

`X-Valorae-Ecosystem-Contract`

O Proxy:

- aceita e expõe o cabeçalho;
- devolve a identidade em todas as respostas normalizadas;
- publica o valor em `/ready` e nos metadados;
- expõe o header via CORS quando aplicável.

O diagnóstico do APK agora distingue:

- Proxy indisponível;
- Proxy legado sem o header;
- Proxy correto e pareado;
- Proxy acessível, porém com contrato divergente.

A ausência do header permanece aceita temporariamente como compatibilidade legada, mas uma identidade divergente é explicitamente sinalizada.

### 2.4 Médio — higiene de testes e artefatos

**Evidência encontrada**

- `AssetAnalysisChangesTest.kt` havia reaparecido, embora o recurso correspondente já estivesse aposentado.
- O teste duplicado contradizia contratos que exigiam a remoção da função.
- Caches Python estavam presentes no pacote de origem recebido.

**Correção**

- Teste obsoleto removido.
- Caches `__pycache__` e arquivos `.pyc` excluídos da entrega.
- Gate de higiene do release preservado.
- Novo teste `test_ecosystem_maturity_v582.py` criado para cobrir identidade, visual ativo e pareamento.

### 2.5 Médio — contratos históricos aceitavam somente datas antigas

Alguns testes do Proxy possuíam listas e expressões regulares encerradas em `2026.08.04` ou `21.12.400`. Isso causava falhas artificiais ao promover corretamente o ecossistema.

**Correção**

- Contratos de compatibilidade estendidos para `2026.08.05.01` e `21.12.401`.
- Versões futuras continuam recusadas fora da janela homologada.
- Não houve relaxamento genérico para aceitar qualquer versão.

## 3. Auditoria do APK

### 3.1 Arquitetura e navegação

- 217 arquivos Kotlin de produção.
- 19 telas inventariadas e alcançáveis.
- 12 páginas de Configurações mapeadas.
- Nenhum callback clicável vazio encontrado.
- Destinos Início, Carteira, Notícias e Análise ligados.
- Subpáginas de Configurações preservadas em recriação da Activity.
- Notícias deixam de ser compostas e atualizadas quando a página não está ativa.

### 3.2 Dados financeiros

Foram revalidados:

- importação B3;
- compras e vendas históricas;
- preservação de operações legítimas duplicadas;
- restauração atômica da nuvem;
- magnitude e sinal de transações;
- cálculo de patrimônio por mês;
- histórico de preço da carteira;
- início real da carteira;
- elegibilidade de proventos por Data COM/Data EX;
- contratos de retorno e benchmarks;
- ausência de séries financeiras sintéticas.

Nenhuma regra de cálculo financeiro foi alterada nesta auditoria, exceto a restauração de informações visuais e diagnósticas previamente revertidas.

### 3.3 Proxy e rede

- 15 chamadas Proxy inventariadas pelo auditor do APK.
- Gateway universal de modal preservado.
- Rotas legadas de modal continuam aposentadas.
- JSON canônico preservado.
- Nenhum segredo HMAC obrigatório embutido no aplicativo.
- Host principal, contingência e failover existentes foram preservados.
- O contrato do ecossistema foi incluído no cliente HTTP e no cliente de sincronização.

### 3.4 Notificações em segundo plano

- Worker periódico opt-in a cada 6 horas.
- Rede obrigatória.
- Backoff e retentativa preservados.
- Fechamento diário em worker independente, em dias úteis.
- Reagendamento após boot, atualização e desbloqueio.
- Permissão geral, canais e bloqueios específicos tratados separadamente.
- Gráfico diário produzido localmente e validado como BigPicture.
- Clique de notícias abre diretamente a Activity, sem notification trampoline.

### 3.5 Segurança e privacidade

Pontos positivos:

- `allowBackup=false`.
- Receivers internos `exported=false`.
- FileProvider privado e com concessão temporária.
- Compartilhamento somente leitura.
- Restauração e retentativas respeitam o ciclo de vida.
- Nenhuma telemetria operacional foi adicionada.

Pontos que exigem governança de distribuição:

- `REQUEST_INSTALL_PACKAGES`: necessário para atualização fora da Play Store, mas sujeito a política da loja e deve permanecer restrito à distribuição privada.
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`: útil para confiabilidade de background, porém deve ser solicitado de forma contextual e não coercitiva.

Essas permissões não foram removidas porque fazem parte do modelo atual de distribuição e notificações do produto.

### 3.6 Dívida técnica identificada

Há 15 arquivos de produção com 55 KB ou mais. Os principais candidatos a decomposição futura são:

- `ValoraeNotificationCenter.kt`
- `PatrimonyTotalModalComponents.kt`
- `SettingsPages.kt`
- `PortfolioHomeUi.kt`
- `AnalysisDiscoveryUi.kt`
- `PortfolioDashboardModalUi.kt`
- `PortfolioViewModel.kt`
- `AnalysisChartsUi.kt`
- `PortfolioSparklineChartsUi.kt`

Não foram feitos splits amplos nesta auditoria para evitar regressão arquitetural sem necessidade imediata. O risco foi documentado.

## 4. Auditoria do Proxy

### 4.1 Runtime e implantação

- Build Vercel aprovado.
- 424 arquivos JavaScript com sintaxe validada.
- 152 de 152 módulos de runtime alcançáveis.
- Nenhum `fetch`, `setInterval` ou `setTimeout` indevido em imports sob demanda.
- SQL mínimo validado: instalador único, três scripts canônicos e duas tabelas financeiras.
- Monitor permanece estático, sem telemetria e sem conexão automática.

### 4.2 Rotas e contrato

- 17 endpoints móveis homologados preservados no roteador e monitor.
- Endpoint `/ready` publica a identidade do ecossistema.
- Headers de contrato são retornados por `lib/core/http.js` e `lib/performance/http.js`.
- Compatibilidade mínima: `2026.07.30.01`.
- Compatibilidade máxima homologada: `2026.08.05.01`.
- Versões futuras não homologadas continuam bloqueadas.

### 4.3 Segurança

- Identidade canônica do cliente preservada.
- CORS de produção restrito.
- Allowlist de rotas de produção validada.
- Proteção contra destinos de rede inseguros preservada.
- Limites de runtime e normalização de entradas aprovados.
- Rate limit, cache e coalescência continuam locais por instância serverless; proteção distribuída deve ser configurada na borda da plataforma caso o tráfego cresça.

### 4.4 Dependências e testes bloqueados

A suíte foi executada com tolerância explícita a dependências ausentes:

- 169 testes aprovados.
- 100 testes bloqueados.
- 0 falhas.

Bloqueios:

- 99 testes dependem de `cheerio`.
- 1 teste depende de `undici`.

O `package.json` declara as dependências, mas elas não estavam instaladas no ambiente. Isso é uma limitação de execução, não aprovação desses 100 testes. A instalação deve ser garantida no CI oficial com Node 24 e lockfile íntegro.

## 5. Validação cruzada APK ↔ Proxy

Resultados:

- Alinhamento APK/Proxy: **15/15**.
- Suíte cross-stack: **26 aprovados, 17 bloqueados por dependências, 0 falhas**.
- Versão do APK no Proxy: `2026.08.05.01`.
- Versão do Proxy no APK: `21.12.401`.
- Contrato textual idêntico nos dois metadados.
- Contrato de ecossistema idêntico no código e nos metadados.
- Baselines de Patrimônio e Retorno comparadas entre os projetos.
- Rotas móveis comparadas com o roteador real.

## 6. Validação executada

### APK

- Quality gate integral: **aprovado**.
- 60 testes de regressão ativos: **aprovados**.
- Gradle Wrapper: íntegro e fixado por SHA-256.
- Dependências Gradle: auditadas.
- Delimitadores Kotlin: balanceados em 217 arquivos.
- Padrões conhecidos de risco de compilação: ausentes.
- Estrutura, navegação, notificações, sincronização, restauração, gráficos e contratos financeiros: aprovados.

### Proxy

- `npm run verify`: aprovado com dependências ausentes explicitamente bloqueadas.
- Build Vercel: aprovado.
- Sintaxe: aprovada.
- Runtime reachability: 152/152.
- SQL: aprovado.
- Consistência de versão: aprovada.
- Testes: 169 aprovados, 100 bloqueados, 0 falhas.

### Compilação Android

A compilação `:app:compileDebugKotlin` foi iniciada, mas o Gradle Wrapper não conseguiu resolver `services.gradle.org` para baixar o Gradle 8.10.2:

`java.net.UnknownHostException: services.gradle.org`

Portanto, esta auditoria não produz nem afirma a existência de um APK binário compilado. A entrega é o projeto-fonte corrigido e validado pelos gates disponíveis.

## 7. Estado final

O ecossistema termina a auditoria com:

- identidade de release não ambígua;
- árvore visual ativa restaurada;
- contrato APK–Proxy verificável;
- diagnóstico capaz de detectar implantação divergente;
- rotas e versões alinhadas;
- testes obsoletos removidos;
- zero falhas nas suítes executáveis;
- limitações de ambiente explicitamente registradas.

A publicação operacional exige implantar o Proxy v401 e compilar/instalar o APK v582 como um par. Misturar o APK v582 com uma implantação antiga continuará funcional dentro da retrocompatibilidade, mas o diagnóstico indicará a ausência ou divergência do contrato de ecossistema.

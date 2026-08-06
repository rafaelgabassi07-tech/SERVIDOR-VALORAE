# Auditoria continuada do ecossistema VALORAE — APK v583 / Proxy 21.12.402

Data: 2026-08-05

## Escopo

A auditoria foi executada sobre os pacotes v582/v401 efetivamente entregues, tratando APK e Proxy como um único sistema. Foram revisados transporte HTTP, identidade de release, compatibilidade, sincronização financeira, notificações, séries financeiras, persistência local, restauração em nuvem, segurança, monitor e gates de release.

## Resultado executivo

A rodada encontrou quatro fragilidades de integração que poderiam produzir falhas intermitentes ou uso silencioso de um Proxy incorreto:

1. O APK recebia o contrato de ecossistema, mas as rotas financeiras não o impunham de forma estrita.
2. O cliente principal lembrava o host saudável somente em memória; após reinício do processo, voltava ao host primário mesmo que ele estivesse indisponível.
3. A sincronização financeira utilizava um único host e não possuía failover persistente.
4. A função direta `/api/sync` não passa pelo roteador móvel e, portanto, ainda aceitava contratos de ecossistema explicitamente incompatíveis.

As quatro falhas foram corrigidas. O ecossistema foi promovido para APK `2026.08.05.02` (v583), Proxy público `21.12.402` e contrato `valorae-ecosystem-2026.08.05.02-p402`.

## Correções no APK

### Transporte principal do Proxy

- O endpoint que respondeu corretamente agora é persistido em `SharedPreferences`.
- Na inicialização, o cliente restaura o endpoint preferido somente se ele ainda pertencer à lista de hosts configurados.
- O failover passa a ocorrer também quando a resposta contém contrato de ecossistema incompatível.
- Respostas explicitamente divergentes não são mais memorizadas como saudáveis.
- O contrato de ecossistema passou a ser requisito de integridade nas leituras financeiras estritas.
- Versão pública e versão central do Proxy são lidas separadamente dos headers.

### Sincronização financeira

- Adicionado host de contingência independente por `VALORAE_SYNC_FALLBACK_BASE_URL`.
- Adicionado failover para falhas de conexão, incompatibilidade de contrato e estados HTTP recuperáveis.
- O endpoint saudável da sincronização é persistido entre reinicializações.
- Respostas da sincronização são validadas por protocolo móvel e contrato de ecossistema antes da aplicação local.
- O transporte da sincronização é inicializado junto ao grafo principal do aplicativo.

### Diagnóstico

- O diagnóstico agora diferencia:
  - versão pública do Proxy;
  - versão central do motor;
  - contrato esperado;
  - contrato recebido;
  - endpoint efetivamente utilizado.
- Uma resposta HTTP válida, mas pertencente a outro ecossistema, deixa de ser classificada como conexão saudável.

## Correções no Proxy

### Identidade operacional

- Versão pública: `21.12.402`.
- Versão central preservada: `21.12.0`.
- Patch: `21.12.402-ecosystem-hardening-v411`.
- APK pareado: `2026.08.05.02`.
- Monitor: `vertical-flow-v405`.
- Contrato atual: `valorae-ecosystem-2026.08.05.02-p402`.
- Contrato anterior p401 permanece aceito para rollout gradual.

### Headers e prontidão

Todas as respostas JSON/texto do runtime passam a expor explicitamente:

- `X-Valorae-Public-Version`;
- `X-Valorae-Core-Version`;
- `X-Valorae-Ecosystem-Contract`.

O endpoint `/ready` e os metadados distinguem a versão pública da versão central, evitando diagnósticos ambíguos.

### Rejeição de pares incompatíveis

- O roteador móvel responde HTTP 426 `ECOSYSTEM_CONTRACT_MISMATCH` quando o cliente envia um contrato explicitamente incompatível.
- A ausência do header continua aceita apenas para retrocompatibilidade.
- A função direta `/api/sync` recebeu a mesma proteção; anteriormente ela não passava pelo roteador e escapava dessa validação.
- O contrato p401 anterior é aceito para permitir atualização gradual sem indisponibilidade imediata.

## Compatibilidade e comportamento preservado

Não foram alterados:

- cálculos de patrimônio, retorno ou proventos;
- importação B3;
- tabelas financeiras do Supabase;
- deduplicação de dividendos e transações;
- agenda de notificações;
- rotas de modais;
- política de monitor estático sem telemetria;
- compatibilidade mínima do APK `2026.07.30.01`.

Nenhum valor financeiro sintético foi introduzido.

## Validação do APK

- Quality gate integral: aprovado.
- Regressões ativas: **61 testes aprovados**.
- Auditoria de páginas: **27/27**.
- Contrato de transporte v583: **14/14**.
- Arquivos Kotlin verificados: **217**.
- Telas encontradas e alcançáveis: **19**.
- Páginas de Configurações mapeadas: **12**.
- Delimitadores Kotlin: balanceados.
- Gradle Wrapper: íntegro e validado por SHA-256.
- Notificações em segundo plano, fechamento diário, gráficos, proventos, sincronização e restauração: revalidados.

## Validação do Proxy

- Build Vercel: aprovado.
- Sintaxe: **425 arquivos JavaScript** aprovados.
- Imports sob demanda: aprovado, sem `fetch`, intervalos ou timers no carregamento.
- Alcance do runtime: **152/152 módulos**.
- SQL mínimo: aprovado; instalador único e três arquivos canônicos.
- Consistência de versão: core `21.12.0`, público `21.12.402`, patch v411.
- Suíte: **170 testes aprovados**, **0 falhas**.
- Bloqueados: **100** por dependências ausentes (`cheerio`: 99; `undici`: 1).
- Cross-stack: **26 aprovados**, **0 falhas**, **17 bloqueados** pelas mesmas dependências.
- Teste dedicado confirmou HTTP 426 no roteador e em `/api/sync` para contrato divergente.

## Limitações reais

### Compilação Android

A compilação `:app:compileDebugKotlin` foi iniciada, mas o Gradle Wrapper não conseguiu baixar o Gradle 8.10.2 devido a `UnknownHostException: services.gradle.org`. Assim, o pacote entregue contém o projeto-fonte auditado, não um binário `.apk` compilado neste ambiente.

### Gate formal do Proxy

`verify:release` exige Node 24.x, enquanto o ambiente possui Node 22.16.0. Os comandos internos que compõem o gate foram executados separadamente e aprovados. A suíte completa permaneceu parcialmente bloqueada pela ausência local de `cheerio` e `undici`.

### Risco estrutural residual

Há 15 arquivos Kotlin grandes; os principais são `ValoraeNotificationCenter.kt`, `PatrimonyTotalModalComponents.kt`, `SettingsPages.kt`, `PortfolioHomeUi.kt` e `PortfolioViewModel.kt`. A decomposição completa foi adiada porque alteraria uma superfície extensa e aumentaria o risco de regressão nesta rodada. O risco está documentado para uma refatoração isolada, acompanhada de instrumentação em dispositivo.

## Conclusão

A rodada não se limitou a atualizar versões ou testes. Ela fechou falhas reais de pareamento e transporte que poderiam fazer o aplicativo utilizar um servidor divergente, perder o host saudável após reinício ou deixar a sincronização sem contingência. APK e Proxy agora compartilham uma identidade verificável, rejeitam incompatibilidades explícitas e mantêm failover persistente nos dois caminhos de rede.

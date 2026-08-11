# VALORAE v655 — auditoria profunda de APK + Proxy

Data da consolidação: 2026-08-11

## Identidade da entrega

- APK: v655 / versionName `2026.08.11.03` / versionCode `26081103`
- Checkpoint: `v655-market-ticker-session-deep-audit`
- Fingerprint de `app/src/main`: `0540de0f46e3d2b7`
- Proxy público: `21.12.405`
- Mobile protocol: `2026.07.10.10`
- Ecosystem contract: `valorae-ecosystem-2026.08.05.04-p404`
- Financial sync: `valorae-financial-sync-v2`

## 1. Categorias — títulos das subpáginas

### Problema encontrado
A lista principal havia sido neutralizada, mas o cabeçalho da subpágina ainda reutilizava a cor semântica/setorial da categoria. Isso explicava por que o usuário continuava vendo ícones coloridos mesmo após a adoção do Conceito 4.

### Correção
O componente compartilhado `AnalysisCategorySegmentIcon` passa a usar badge grafite sólido e `MaterialTheme.colorScheme.primary` no ícone. A lista principal e o cabeçalho da subpágina agora obedecem à mesma identidade institucional.

### Validação
- `test_analysis_category_subpage_header_concept4_v655.py`: 4/4
- contrato do Conceito 4: 7/7

## 2. Ticker de mercado e carrossel

### Diagnóstico
O ecossistema dependia excessivamente do Yahoo em alguns slots e tratava a B3 como contingência tardia. Isso deixava o ticker vulnerável a símbolo ausente, rate-limit ou resposta parcial. USD e IVVB11 ainda tinham um único provedor dominante em cold start.

### Política de fontes após a correção
- IBOV, IFIX, IDIV e SMLL: Yahoo em paralelo com evolução diária oficial B3; B3 é contingência oficial primária e Investidor10 fica como terceiro recurso.
- USD: Yahoo + BCB SGS 1 (dólar venda diário) em paralelo; BCB é contingência oficial.
- IVVB11: Yahoo + cotação pública da B3/Bora Investir em paralelo.
- CDI: BCB SGS 12 e 4391 consultados em paralelo; fallback para últimos valores oficiais.
- IPCA: BCB SGS 433 como fonte principal, com recuperação real já existente quando necessário.
- Nenhum slot cria valor sintético para fingir disponibilidade.

### Carrossel
O tape foi redesenhado para cinco ciclos físicos, sempre ancorado no ciclo central. O deslocamento usa relógio monotônico compartilhado (`SystemClock.elapsedRealtimeNanos`) e sobrevive a recomposição/remoção temporária da composição. Drag horizontal pausa/reancora a fase; máscaras laterais foram reduzidas e a velocidade passou para 52 dp/s.

### Validação
- APK ticker/carrossel: 8/8
- contrato completo do ticker: 22/22
- fallback oficial B3: aprovado
- simulação de indisponibilidade total do Yahoo: todos os 8 slots recuperados por fontes B3/BCB nos testes
- Proxy `analysis-market-ticker-v646`: aprovado

## 3. Gráfico “Preço da carteira” após fechamento

### Problemas encontrados
Havia duas extensões indevidas da curva:
1. O APK ainda aceitava uma janela maior que a sessão regular.
2. O Proxy podia anexar `currentPrice` usando o relógio atual após o fechamento.

Também foi encontrado um calendário B3 antigo com `regularClose=17:55`, inconsistente com a grade atual, e testes dependentes da hora real da máquina.

### Correção
- Intraday atual limitado à sessão regular de mercado e filtrado antes e depois da composição da série.
- `currentPrice` não é anexado fora da sessão.
- Pontos de after-market são descartados.
- O Proxy centraliza a sessão em `b3-calendar.js`.
- Calendário 2026 passa a considerar 24/12 e 31/12 sem sessão e a abertura especial às 13h na Quarta-feira de Cinzas.
- Testes de intraday passaram a usar relógio determinístico, removendo dependência do horário da máquina de CI.

### Validação
- APK `test_portfolio_price_regular_session_v655.py`: 8/8
- runtime Proxy simulado após fechamento: aprovado
- calendário B3 v655: aprovado, incluindo feriado, 17:01, Quarta-feira de Cinzas, 24/12 e 31/12
- regressões históricas do gráfico: aprovadas

## 4. Auditoria estrutural APK

### Higiene e runtime
Foram removidos scratchs da raiz, scripts de correção temporária, caches, outputs intermediários, relatórios duplicados byte a byte e composables/helpers da Análise confirmados sem referência. A limpeza foi conservadora: símbolos com possível consumo por Android/Compose/reflection não foram removidos por heurística cega.

### Gates
- `quality_gate.py --mode static`: APROVADO
- 87 testes canônicos ativos: APROVADOS
- `validate_valorae_release.py`: APROVADO
- 313 arquivos Kotlin com delimitadores balanceados
- 4.877 imports Kotlin, dentro do orçamento do projeto
- runtime wiring das solicitações recentes: 17/17
- release/build consistency: 23/23
- package hygiene: 6/6
- homologação APK↔Proxy: 33/33
- nenhum TODO/FIXME/HACK/XXX encontrado em `app/src/main`

### Limitação de compilação local
A tentativa real `./gradlew :app:compileDebugKotlin --no-daemon` foi executada. O Gradle Wrapper tenta baixar Gradle 8.10.2, mas o ambiente de execução não resolve `services.gradle.org`; a falha ocorre antes do compilador Kotlin (`UnknownHostException`). Portanto esta auditoria não afirma build Android completo neste ambiente.

## 5. Auditoria estrutural Proxy

### Higiene
Foram removidos Gradle simulado/cache local, assets e CSS órfãos confirmados, além de referências obsoletas na ignore list. Aliases públicos duplicados de downloads Kotlin foram mantidos deliberadamente por compatibilidade de URL. README e descrição do package foram sincronizados com o pareamento v655.

### Runtime
- `check:syntax`: 459 arquivos JavaScript válidos
- `audit:dead-code`: 154/154 módulos de runtime alcançáveis; 0 standalone não documentados
- `audit:on-demand`: fetch=0, interval=0, timeout=0 no import
- `audit:sql`: instalador único + 3 SQLs canônicos aprovado
- `audit:version`: aprovado
- suíte geral: 302 arquivos; 202 aprovados, 0 falhas, 100 bloqueados apenas por dependências `cheerio`/`undici` ausentes no ambiente
- cross-stack: 43 testes; 26 aprovados, 0 falhas, 17 bloqueados pelas mesmas dependências
- nenhum TODO/FIXME/HACK/XXX encontrado nos módulos de runtime auditados

### SQL/Supabase
`01_transactions.sql`, `02_dividends.sql` e `03_legacy_block_and_verification.sql` são idênticos byte a byte entre APK e Proxy.

### Limitação do gate de release local
`npm run verify:release` exige Node 24.x pelo contrato do projeto. O ambiente disponível usa Node v22.16.0; o gate encerra antes da validação integral por essa exigência. Os audits/testes executáveis individualmente acima foram concluídos.

## Conclusão

A v655 corrige os três defeitos relatados e reduz causas recorrentes de divergência entre fonte entregue e APK efetivamente compilado: identidade de build inédita, fingerprint do source, wiring testado, suíte canônica separada de contratos históricos e pareamento explícito do fingerprint no Proxy. O ecossistema final não depende de um único provedor para nenhum dos oito slots do ticker e não prolonga o gráfico intradiário da carteira com dados pós-pregão.

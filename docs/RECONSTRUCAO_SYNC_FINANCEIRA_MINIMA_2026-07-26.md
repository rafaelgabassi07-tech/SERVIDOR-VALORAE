# Reconstrução da sincronização financeira mínima — 2026-07-26

## Resultado

A sincronização APK ↔ Proxy ↔ Supabase foi substituída por um contrato novo e isolado: `valorae-financial-sync-v2`.

O Supabase passa a persistir somente:

1. autenticação da conta no Supabase Auth;
2. Histórico de transações;
3. Histórico/agenda de dividendos.

Não existe tabela de revisão, cursor, tombstone, snapshot de carteira, feed de notícias, cache de cotações, backup JSON, registro de dispositivo, telemetria ou estado operacional no caminho financeiro novo.

## Arquitetura final

### APK

- autentica diretamente no Supabase Auth;
- envia o bearer da sessão ao Proxy;
- mantém uma outbox local no Room para funcionamento offline;
- após o login, faz uma única chamada `download_financial_data`;
- aplica as transações recebidas no Room e reconstrói a carteira localmente;
- envia operações B3 por `upload_transactions`;
- envia dividendos somente quando o conjunto canônico realmente muda;
- não envia snapshots, notícias, cotações, patrimônio derivado ou telemetria ao Supabase.

### Proxy

- valida o bearer no endpoint `/auth/v1/user`;
- usa a `service_role` exclusivamente no servidor;
- executa uma RPC por download ou mutação financeira;
- não consulta e-mail legado durante o funcionamento normal;
- não utiliza paginação ou cursor entre APK e Proxy;
- mantém monitor, circuit breakers e coordenação somente em memória;
- rejeita contratos antigos e informa explicitamente quando a migration 013 não foi aplicada.

### Supabase

A migration 013 cria somente duas tabelas ativas. Não existe terceira tabela de estado:

#### `public.valorae_financial_transactions`

- `user_id`
- `client_tx_id`
- `transaction_date`
- `operation`
- `symbol`
- `asset_type`
- `quantity`
- `price`
- `gross_value`
- `source`
- `imported_at`
- `updated_at`

#### `public.valorae_financial_dividends`

- `user_id`
- `event_id`
- `ticker`
- `date_com`
- `ex_date`
- `inferred_com_date`
- `eligibility_date_source`
- `payment_date`
- `value_per_share`
- `quantity`
- `estimated_amount`
- `status`
- `source`
- `updated_at`

As tabelas novas não possuem coluna `payload jsonb` duplicando os dados relacionais.

## RPCs novas

- `valorae_financial_upload_transactions_v2`
- `valorae_financial_upload_dividends_v2`
- `valorae_financial_download_v2`
- `valorae_financial_status_v2`
- `valorae_financial_delete_v2`

As funções de escrita utilizam `IS DISTINCT FROM`, evitando `UPDATE`, WAL e tuplas mortas quando o conteúdo recebido é idêntico ao que já está salvo.

A função de download usa índices por UUID e devolve transações e dividendos juntos. O JSON de resposta contém apenas uma representação dos campos; aliases duplicados foram removidos.

## Migração do legado

A migration 013:

1. cria as duas tabelas financeiras novas;
2. migra transações e dividendos das tabelas antigas;
3. resolve identidades antigas por UUID ou e-mail em `auth.users`;
4. ignora identidades órfãs em vez de violar a chave estrangeira;
5. deduplica por identificador financeiro estável;
6. revoga as RPCs antigas `valorae_sync_*`;
7. revoga acesso operacional às tabelas antigas, que permanecem apenas como backup de transição.

Ela não apaga os dados financeiros antigos durante a instalação.

## Fluxo de importação B3

1. O APK importa a planilha e grava no Room.
2. A outbox agrupa os tickers alterados.
3. O APK chama `upload_transactions` uma vez por ação.
4. O Proxy valida a sessão.
5. O Proxy chama `valorae_financial_upload_transactions_v2`.
6. A RPC insere, atualiza somente linhas diferentes e remove apenas operações ausentes dos tickers substituídos.

Não há snapshot posterior da carteira.

## Fluxo de restauração após reinstalação

1. O usuário faz login no Supabase Auth.
2. O APK chama `download_financial_data`.
3. O Proxy valida o mesmo UUID da sessão.
4. O Proxy chama `valorae_financial_download_v2` uma única vez.
5. A RPC lê as duas tabelas pelo UUID indexado.
6. O APK valida o contrato e as contagens.
7. O APK substitui o cache Room e reconstrói posições, patrimônio e preço médio localmente.

Não há cursor, segunda página, revisão global, consulta por e-mail ou snapshot que possa interromper a restauração.

## Recursos removidos do caminho operacional

- `valorae_user_snapshots`
- `valorae_sync_backups`
- `valorae_sync_clients`
- `valorae_sync_user_state`
- `valorae_monitor_events`
- `valorae_runtime_shared_state`
- eventual `valorae_financial_state` de rascunhos anteriores
- snapshots de notícias e carteira
- persistência do monitor
- persistência de circuit breaker e leases
- backups integrais em JSON

A migration 014 limpa esses dados depois da validação do novo fluxo. As tabelas financeiras legadas permanecem temporariamente como rollback e não recebem tráfego.

## Ordem obrigatória de implantação

1. Faça um backup/exportação do Supabase, caso deseje uma cópia externa.
2. Deixe o deployment do Proxy v363 pronto para publicação.
3. Execute `013_valorae_minimal_financial_sync_v2.sql` no SQL Editor.
4. Confirme no resultado final as contagens `transactions_migrated`, `dividends_migrated` e `users_with_financial_data`.
5. Publique imediatamente o Proxy v363 deste pacote, porque a migration bloqueia as RPCs antigas.
6. Compile e instale o APK v548.
7. Faça login em uma instalação limpa e confirme que o Histórico aparece.
8. Importe uma pequena planilha, confirme o envio e repita a restauração.
9. Somente após essa confirmação execute `014_valorae_remove_nonessential_cloud_data.sql`.

A migration 013 revoga o contrato antigo. Portanto, não mantenha o Proxy anterior em produção após executá-la.

## Configuração necessária no Proxy

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEY`

Mantenha desativadas/removidas variáveis antigas de persistência. Mesmo que permaneçam configuradas, o código novo força monitor e shared state para memória.

## Validação realizada

- contrato mínimo do APK: **23/23**;
- importação B3: **14/14**;
- sincronização de dividendos: **9/9**;
- Patrimônio Total refinado: **12/12**, contrato visual **14/14**, contrato financeiro **13/13** e DY **15/15**;
- auditoria funcional das páginas: **27/27**;
- restauração automática após login, outbox e retry manual: aprovados;
- teste integrado upload → nova instalação/token → download: aprovado;
- build do Proxy para Vercel: aprovado;
- sintaxe: **521 arquivos JavaScript**;
- suíte completa do Proxy: **176 aprovados, 107 bloqueados por dependências de scraping e 0 falhas**;
- testes cross-stack: **24 aprovados, 17 bloqueados por dependências de scraping e 0 falhas**;
- auditoria de versão APK/Proxy: aprovada;
- estrutura SQL: duas tabelas, nove funções, delimitadores e parênteses balanceados.

## Limitações reais da validação

- Não foi possível executar a migration no Supabase real porque não há credenciais da conta no ambiente.
- Não foi possível realizar login real contra o deployment do usuário.
- A compilação Gradle não iniciou porque o wrapper tentou baixar `gradle-8.10.2-bin.zip` e o ambiente não resolveu `services.gradle.org`.
- Testes do Proxy dependentes de `cheerio` e `undici` ficaram bloqueados por dependências ausentes; eles são de scraping e não participam da sincronização financeira.

## Rollback

As tabelas antigas `public.valorae_transactions` e `public.valorae_dividend_events` são preservadas pela migration 013. Se for necessário investigar uma divergência, os dados continuam disponíveis pelo SQL Editor, embora o Proxy novo não tenha permissão operacional para consultá-los.

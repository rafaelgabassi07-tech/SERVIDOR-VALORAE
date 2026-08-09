# VALORAE — Auditoria APK ↔ Proxy ↔ Supabase e correção da restauração cloud

Data: 2026-07-26

## Evidência observada

- A importação da planilha B3 grava corretamente no Supabase: login, JWT, projeto Supabase, rota `/api/sync`, RPC de escrita e identidade UUID estão operacionais.
- Nos eventos do Proxy, a leitura de `/api/sync` retornava uma primeira resposta `200` com aproximadamente 91 KB e, logo depois, uma resposta `400` pequena.
- O APK exibiu “O Histórico mudou durante a leitura”, mensagem usada para falhas de cursor na segunda ou nas páginas seguintes.
- O padrão é compatível com uma conta que possui mais de 500 transações: a primeira página chega, a segunda é rejeitada, e o APK descarta a sequência incompleta para não substituir o Room por um histórico truncado.

## Fluxo auditado

1. Supabase Auth autentica o usuário no APK e entrega `access_token` e UUID.
2. O APK envia `Authorization: Bearer <JWT>` ao Proxy em `/api/sync`.
3. O Proxy valida o JWT em `/auth/v1/user` usando a chave pública do mesmo projeto.
4. O Proxy usa a service role somente no servidor para ler/escrever as tabelas financeiras.
5. `get_transactions` lê por UUID atual e, quando fisicamente possível, combina o namespace legado do e-mail verificado.
6. O APK pagina até `next_cursor = null`, deduplica por `clientTxId` e somente então substitui atomicamente o Histórico no Room.
7. A carteira consolidada é reconstruída a partir das transações; snapshots são apenas fallback quando não existe Histórico.
8. Proventos são lidos depois da persistência das transações e não bloqueiam mais o Histórico.

## Desalinhamentos encontrados e corrigidos

### 1. Cursor dependente da instância do Proxy

O cursor antigo era assinado com segredo de ambiente. Em Vercel, a página seguinte podia alcançar outra instância/deployment com segredo diferente e receber `SYNC_CURSOR_INVALID` HTTP 400.

Correção: cursor de transações `tx2`, estável entre instâncias e deployments, isolado pelo JWT/usuário autenticado. O cursor legado continua aceito para compatibilidade durante a atualização.

### 2. Revisão global usada como revisão de transações

A mesma `revision` é incrementada por transações, snapshots e proventos. O Proxy e o APK invalidavam a paginação quando qualquer uma dessas áreas mudava, mesmo sem alteração no Histórico.

Correção: a leitura de transações não é mais abortada por alteração de revisão causada por snapshots/proventos. A cerca forte permanece para `deletion_generation` e `tombstone`, impedindo restaurar dados depois de exclusão da conta/carteira.

### 3. Limite padrão do PostgREST

Uma única consulta pode ser limitada pelo servidor, frequentemente a 1.000 linhas. O fluxo anterior tentava recuperar todo o prefixo necessário em uma chamada, podendo truncar históricos grandes.

Correção: o Proxy busca cada identidade em blocos de até 500 registros, combina, ordena e deduplica antes de formar a página entregue ao APK. Testado com 1.620 transações em quatro páginas.

### 4. UUID atual versus e-mail legado

Em instalações com `user_id UUID`, consultar o e-mail legado gera `22P02`. Em instalações com `user_id text`, dados antigos podem existir no e-mail e novos no UUID.

Correção: o UUID é sempre a identidade principal; erro apenas no fallback legado não derruba a leitura válida. Quando ambas as identidades são aceitas, os registros são combinados e o UUID vence duplicatas.

### 5. Registros antigos sem `client_tx_id`

O fallback anterior podia gerar o mesmo ID para várias linhas vazias e colapsá-las.

Correção: o ID legado é derivado do conteúdo econômico da transação (ticker, data, operação, quantidade, preço, valor e fonte). Linhas distintas permanecem distintas.

### 6. Amortizações com quantidade zero

O Proxy preservava operações com valor financeiro, mas camadas do repositório Android ainda filtravam `quantity > 0`, descartando amortizações com `quantity = 0` e `grossValue > 0` após o download.

Correção: inserção, upsert, substituição integral e envio da outbox aceitam transações com ticker e `(quantity > 0 || grossValue > 0)`.

### 7. Contrato `has_more` sem cursor

O APK podia encerrar silenciosamente caso uma resposta informasse `has_more=true` mas omitisse o cursor.

Correção: essa resposta agora é rejeitada como `SYNC_CURSOR_INVALID` e a leitura completa é reiniciada de forma limitada, em vez de gravar histórico truncado.

### 8. Tipo de `transaction_date`

Os bootstrap SQL antigos criavam `transaction_date bigint`, enquanto as RPCs atuais usam ISO/timestamptz.

Correção: os scripts de instalação passaram a criar `transaction_date timestamptz`; a migração 006 continua convertendo projetos antigos que armazenavam epoch em bigint.

## Contratos que já estavam alinhados

- O APK e o Proxy usam o mesmo endpoint `/api/sync` e os mesmos nomes de ação.
- O JWT do usuário é enviado no header `Authorization` e validado pelo Proxy.
- A service role não é incorporada ao APK.
- A escrita B3 utiliza UUID autenticado, IDs idempotentes e RPCs revisionadas.
- O login executa leitura antes de enviar pendências locais.
- O Room só é substituído após concluir todas as páginas.
- Tombstone e geração de exclusão continuam protegendo contra ressurreição de dados apagados.
- A consulta de proventos é secundária e não impede a restauração das transações.

## Implantação

1. Publicar o Proxy corrigido.
2. Confirmar no Vercel que `SUPABASE_URL`, chave pública e `SUPABASE_SERVICE_ROLE_KEY` pertencem ao mesmo projeto usado pelo APK.
3. Manter instaladas as RPCs da migração `006_valorae_financial_sync_integrity_v358.sql` ou do pacote `supabase/release_2026_07_25`.
4. Compilar e instalar o APK corrigido.
5. Reinstalar, autenticar e aguardar a restauração automática. O refresh manual deve retornar a contagem integral, inclusive acima de 500/1.000 registros.

## Validação automatizada

- paginação com 1.620 transações: aprovada;
- troca de segredo/instância entre páginas: aprovada;
- alteração de revisão global por operação não relacionada: aprovada;
- UUID + e-mail legado: aprovada;
- UUID com fallback legado `22P02`: aprovada;
- registros antigos sem `client_tx_id`: aprovados;
- preservação de amortização com quantidade zero: aprovada por contrato Android;
- schema `transaction_date` alinhado: aprovado;
- build Vercel e verificação sintática: aprovados.

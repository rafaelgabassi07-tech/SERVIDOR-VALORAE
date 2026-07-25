# VALORAE Proxy — compatibilidade da restauração da nuvem

Data: 2026-07-24  
Proxy base: v362 (`21.12.394-runtime-safety-v362`)

## Falhas localizadas

1. Linhas antigas de proventos com `payload = {}` perdiam os campos armazenados nas colunas da tabela, pois um objeto JSON vazio era tratado como payload completo.
2. O retorno de transações priorizava somente o payload e as colunas do schema atual; linhas legadas com `symbol`, `date`, `operation`, `price` e `gross_value` podiam chegar incompletas ao APK e ser descartadas.
3. Instalações antigas podiam ter linhas vinculadas ao e-mail da conta, enquanto a autenticação atual consulta pelo UUID do Supabase Auth.

## Correções

- Normalização explícita e allow-list de transações atuais e legadas antes de responder ao APK.
- Mesclagem de payload parcial com as colunas canônicas de proventos, inclusive quando o payload é `{}`.
- Fallback seguro de leitura para o e-mail verificado pelo próprio Supabase Auth quando o UUID autenticado não possui linhas.
- Compatibilidade aplicada a transações, proventos e snapshots; mutações novas continuam vinculadas ao UUID autenticado.
- Identidade usada na leitura exposta como metadado aditivo `identitySource`, sem alterar o contrato consumido pelo APK.

## Validação

- Integração simulada de login + UUID sem linhas + dados legados por e-mail: aprovada.
- Compatibilidade de transações e proventos com payload vazio/parcial: aprovada.
- Testes de autenticação, resiliência, nuvem principal, histórico e integridade financeira: aprovados.
- Verificação sintática: 496 arquivos JavaScript aprovados.
- Build Vercel: aprovado.
- Auditoria de versão: aprovada.
- Suíte global: 147 arquivos aprovados, 107 bloqueados por dependências não vendorizadas e 8 falhas históricas de Análise/pareamento de versão do APK, sem relação com `/api/sync`.

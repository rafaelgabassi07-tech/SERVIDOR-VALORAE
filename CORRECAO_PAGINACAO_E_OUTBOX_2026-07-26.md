# Correção de paginação do Histórico e envio da outbox — 2026-07-26

## Sintomas reproduzidos

- Atualização manual: `O Proxy recusou a paginação do histórico`.
- Conta VALORAE: duas mudanças aguardando, última conclusão ausente e falha desconhecida.
- Importação B3 permanecendo no aparelho sem concluir o envio ao Supabase.

## Causas

1. A leitura dependia de cursor opaco assinado pelo Proxy. Deploys mistos ou instâncias com segredo diferente podiam aceitar a primeira página e rejeitar a seguinte.
2. O botão `Tentar agora` reativava apenas ações `running`. Ações `failed` continuavam presas ao `nextAttemptAt` do backoff, portanto a tentativa manual podia não enviar nada.
3. A falha da leitura interrompia o fluxo manual antes de tentar a outbox local.
4. Os erros HTTP estruturados eram transformados em mensagem genérica antes de chegar à tela.
5. Timeouts e limite de corpo eram estreitos para históricos B3 grandes.

## Correções no APK

- Leitura prioritária por `restore-v1`, sem cursor opaco, até 5.000 operações.
- Continuação por `offset-v1` quando houver mais páginas.
- Fallback para cursor somente para Proxy antigo.
- Reinício limitado para incompatibilidades de cursor/offset/protocolo.
- Exclusão/tombstone continuam sendo cercas de consistência.
- Falha de leitura não bloqueia mais o envio da outbox.
- `Tentar agora` redefine `nextAttemptAt` de ações `pending`, `failed` e `running` e tenta todas imediatamente.
- Códigos HTTP, `requestId`, retry e mensagens específicas são preservados sem expor dados financeiros.
- Timeouts de sync: leitura 45 s, escrita 30 s e chamada total 60 s.
- Limpeza local preserva amortizações com quantidade zero e valor financeiro positivo.

## Correções exigidas no Proxy correspondente

- Protocolo `restore-v1`/`offset-v1` com `next_offset`.
- Compatibilidade de leitura com cursores antigos assinados por outro deployment.
- Limite configurável de payload de sincronização, padrão de 2 MiB.
- Paginação Supabase em blocos e resposta estável entre instâncias.

## Operação segura

1. Publicar o Proxy corrigido.
2. Compilar o APK corrigido com o mesmo `applicationId` e a mesma assinatura do APK instalado.
3. Instalar como atualização, sem desinstalar, para preservar as duas ações da outbox local.
4. Abrir Conta VALORAE e tocar em `Tentar agora`.

Desinstalar antes do envio remove o banco Room e, com ele, as alterações que ainda existem apenas no aparelho.

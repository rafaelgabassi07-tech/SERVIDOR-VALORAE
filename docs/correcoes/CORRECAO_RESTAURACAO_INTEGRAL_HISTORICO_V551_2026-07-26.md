# Correção da restauração integral do Histórico — APK v551 / Proxy v363

## Sintoma

Após login em uma instalação limpa, o APK recebia apenas parte das operações armazenadas. Vendas ausentes mantinham posições já encerradas na Carteira e distorciam a elegibilidade e as quantidades usadas nos dividendos.

## Causas corrigidas

1. Quantidades e valores negativos podiam ser convertidos em zero durante a normalização. Em dados antigos, o sinal frequentemente identificava uma saída/venda.
2. Duas operações diferentes com o mesmo `client_tx_id` eram consolidadas silenciosamente pelo Proxy.
3. A migration 013 podia gerar o mesmo identificador para linhas legadas distintas e, em alguns formatos, não incluía informação suficiente no seed.
4. O APK validava o tamanho bruto do array, mas ainda podia filtrar algumas operações depois da desserialização e aplicar o restante.
5. O Room usava `REPLACE`; uma colisão de `clientTxId` podia reduzir a quantidade efetivamente gravada sem uma verificação transacional posterior.

## Correções

- Quantidade, preço e valor bruto assinados são normalizados pela magnitude absoluta; o sinal negativo infere `VENDA` quando a operação não está explícita.
- O Proxy preserva operações diferentes que compartilham um ID antigo, criando um ID determinístico adicional.
- Lotes com linhas inválidas são recusados por inteiro; não existe upload parcial.
- O download recusa IDs ausentes ou duplicados.
- O APK exige igualdade entre quantidade declarada, desserializada e normalizada.
- A gravação do Histórico no Room verifica a contagem dentro da mesma transação; qualquer divergência provoca rollback completo.
- A migration 015 reimporta `valorae_transactions` para `valorae_financial_transactions`, preservando compras, vendas e multiplicidade. Ela não apaga dados financeiros.

## Ordem de implantação

1. Execute `015_valorae_restore_all_transactions_repair.sql` no SQL Editor.
2. Confira o resultado final, principalmente `total_transactions`, `sales` e `purchases`.
3. Publique `valorae-proxy-v363-complete-history-restore-AI-STUDIO-ROOT.zip`.
4. Compile e instale `apk-valorae-v551-complete-cloud-history-restore-AI-STUDIO-ROOT.zip`.
5. Em uma instalação limpa, faça login e use “Atualizar Histórico”.

A migration 015 depende da migration 013 já instalada. A migration 014 não remove as tabelas legadas de transações e dividendos, portanto o reparo continua possível mesmo depois da limpeza opcional.

## Validação

- Proxy: 289 arquivos de teste; 182 aprovados, 0 falhas e 107 bloqueados por dependências de scraping ausentes (`cheerio`/`undici`).
- Teste novo de compra/venda com ID colidente: aprovado.
- Upload com linha inválida recusado integralmente: aprovado.
- Download com IDs duplicados recusado: aprovado.
- Cross-stack: 25 aprovados, 0 falhas e 17 bloqueados pelas mesmas dependências de scraping.
- APK: contrato de restauração integral 10/10; sincronização mínima 23/23; B3 14/14; dividendos 9/9; páginas 27/27; validação estrutural de 218 arquivos Kotlin aprovada.
- Build do Proxy e auditoria de versão: aprovados.
- A compilação Gradle não iniciou porque o ambiente não conseguiu resolver `services.gradle.org`.

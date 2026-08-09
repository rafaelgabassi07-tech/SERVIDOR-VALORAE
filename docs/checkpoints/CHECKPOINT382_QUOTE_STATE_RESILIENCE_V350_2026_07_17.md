# Checkpoint 382 — cotações resilientes e persistentes (Proxy v350)

## Objetivo

Reduzir latência e indisponibilidade percebida na carteira sem alterar o contrato já consumido pelo APK.

## Implementação

- o adaptador Yahoo tenta `query1` e `query2` com orçamento dividido e cache stale seguro;
- o normalizador preserva preço, fechamento anterior, variação diária, mercado e horário;
- lotes executam concorrência limitada e o modo `fast_quotes` não aguarda Fundamentus;
- flags de refresh/bypass atravessam a rota individual;
- respostas vazias carregam qualidade explícita sem fabricar valores financeiros;
- erros do fallback de market movers deixam de referenciar variáveis inexistentes.

## Compatibilidade

As rotas, aliases, headers móveis e estruturas financeiras existentes foram preservados. APKs anteriores continuam funcionais; o APK v529 adiciona persistência local do último estado válido.

## Validação

- suíte completa do Proxy;
- testes dedicados de normalização, concorrência, modo rápido e bypass;
- suíte cross-stack com o APK v529;
- auditoria de sintaxe e consistência de release.

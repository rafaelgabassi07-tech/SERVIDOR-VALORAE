# Relatório de auditoria — VALORAE Proxy Monitor v21.13.2

## Escopo

Revisão especial do monitor operacional do VALORAE Proxy, partindo da versão `21.13.1-integration-audit-fix` e gerando a versão `21.13.2-valorae-monitor-audit`.

O APK não precisou ser alterado nesta rodada. A mudança ficou concentrada no Proxy e no monitor público.

## Diagnóstico inicial

O monitor da v21.13.1 funcionava, mas ainda era simples demais para operar o Proxy reconstruído com segurança:

1. consultava `/health`, `/manifest` e `/cache/stats` separadamente;
2. não tinha endpoint próprio de resumo operacional;
3. o botão de teste do contrato mobile não fazia parte de um autoteste formal do Proxy;
4. o service worker existia, mas a tela não registrava o worker;
5. o service worker não usava `skipWaiting()` nem `clients.claim()`;
6. o monitor não mostrava contagem de rotas, rotas primárias e rotas de compatibilidade;
7. o servidor estático poderia ser simplificado para deixar a proteção contra path traversal mais clara;
8. não havia teste automatizado específico para garantir que o monitor continuaria exposto.

## Correções aplicadas

### 1. Novo contrato operacional do monitor

Foram adicionadas duas rotas leves:

```text
/api/v1/monitor/summary
/api/v1/monitor/self-test
```

Aliases também foram mantidos:

```text
/api/v1/server/summary
/api/v1/server/self-test
```

### 2. `/monitor/summary`

Retorna em uma única resposta:

- status do Proxy;
- versão;
- release;
- contrato mobile;
- runtime Node;
- uptime;
- estatísticas de cache;
- rotas primárias;
- total de rotas;
- quantidade de rotas de compatibilidade;
- checks básicos de saúde, contrato e cache.

### 3. `/monitor/self-test`

Executa autoteste leve sem depender de rede externa:

- valida `/mobile/portfolio-sync` com payload pequeno;
- valida bloco de análise;
- valida bloco de histórico;
- valida proteção de dividendos com carteira vazia;
- valida histórico de ativo.

### 4. Monitor visual redesenhado

`public/server.html` foi refeito com:

- layout mais claro;
- cards de saúde, versão, contrato e cache;
- tabela de rotas;
- ações seguras;
- diagnóstico bruto;
- tratamento de erro HTTP e JSON inválido;
- timeout com `AbortController`;
- escape de HTML no conteúdo renderizado;
- registro do service worker;
- sem bibliotecas externas;
- sem nomes externos ao ecossistema VALORAE.

### 5. Service worker revisado

`public/service-worker.js` agora:

- usa cache `valorae-proxy-server-v21-13-2`;
- chama `self.skipWaiting()`;
- chama `self.clients.claim()`;
- não intercepta `/api/`;
- só trabalha com `GET`;
- usa fallback para `/server.html` quando offline.

### 6. Segurança estática do monitor

`server.js` recebeu uma proteção mais explícita contra path traversal:

```text
relative.startsWith('..') || path.isAbsolute(relative)
```

Isso deixa a intenção de segurança mais clara.

### 7. Testes e validações novos

Foram adicionados:

```text
test/monitor.test.js
scripts/verify-monitor-audit-v21-13-2.js
```

## Resultado dos testes

```text
npm run check
Checked 31 JS files
```

```text
npm test
7 test files; failures=0
```

```text
npm run build
Build OK para Vercel
```

```text
npm run smoke
Smoke OK
```

```text
npm run audit:version
Version consistency OK: 21.13.2
```

```text
npm run audit:identity
Identidade VALORAE OK: 0 ocorrências externas.
```

```text
npm run verify
VALORAE Proxy monitor audit v21.13.2 OK
```

Teste local real:

```text
GET /monitor -> 200 OK
GET /api/v1/monitor/summary -> status OK, version 21.13.2
GET /api/v1/monitor/self-test -> status OK, checks OK
```

## Linhas adicionadas/removidas

Runtime/código relevante, sem logs e documentos gerados:

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| Proxy | 11 | +293 | -50 |

Incluindo logs e documentos gerados:

| Projeto | Arquivos alterados | Linhas adicionadas | Linhas removidas |
|---|---:|---:|---:|
| Proxy | 22 | +529 | -50 |

## Conclusão

O monitor agora não é apenas uma página visual. Ele virou um painel operacional real para validar o Proxy reconstruído:

```text
Monitor visual
↓
/monitor/summary
↓
/monitor/self-test
↓
contrato mobile + cache + rotas principais + guardas críticos
```

A identidade VALORAE foi preservada, sem nomes externos, e o Proxy segue enxuto.

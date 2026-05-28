# Auditoria Command Center v21.10.8

Esta versão continua a evolução do VALORAE Proxy Server a partir da v21.10.7, mantendo o `Valorae-engine.js` como núcleo central e preservando a compatibilidade com GitHub/Vercel gratuito.

## Correções e melhorias aplicadas

- Adicionado contador separado de telemetria interna para `/api/server/metrics`, sem poluir requisições, respostas, status, rotas, eventos ou cache/fonte.
- Ajustado cálculo de sucesso HTTP para considerar respostas `2xx` e `3xx`, incluindo `304 Not Modified`, como respostas bem-sucedidas.
- Reforçada a medição de respostas sem corpo (`HEAD`, `204`, `304`) para contabilizar `0 bytes` de saída.
- Adicionada medição média de entrada por rota (`avgBytesIn`), útil para detectar clientes enviando payloads grandes.
- Adicionados indicadores de pressão de runtime:
  - memória RSS em MB;
  - heap usado e total;
  - percentual de uso do heap;
  - score de pressão operacional;
  - idade da chamada ativa mais antiga.
- Adicionados campos de maturidade operacional:
  - `sloStatus`;
  - orçamento de erro restante;
  - tendência de requisições 1m vs 15m;
  - tendência de respostas 1m vs 15m;
  - tendência de erro 1m vs 15m;
  - quantidade de eventos, buckets, rotas e clientes em memória.
- Adicionado bloco `operations` ao endpoint `/api/server/metrics` com:
  - rotas mais lentas;
  - rotas com erro;
  - rotas com maior payload;
  - runbook automático com ações recomendadas.
- Melhorada a página **Performance & SLO** com listas de rotas lentas e rotas com erro.
- Melhorada a página **Diagnóstico Cloud** com pressão de runtime e runbook automático.
- Melhorada a página **Qualidade dos Dados** com SLO, orçamento restante e tendências.
- Adicionado botão para copiar relatório JSON do painel.
- Reforçada a segurança de arquivos estáticos no servidor local, evitando path traversal por normalização/prefixo.
- Atualizado Service Worker para cache `v21.10.8`.

## Compatibilidade preservada

- Sem Redis.
- Sem banco de dados.
- Sem KV.
- Sem WebSocket.
- Sem cron obrigatório.
- Sem fila externa.
- Sem dependências pagas.
- Sem divisão do `Valorae-engine.js`.

## Validação adicionada

Novo script:

```bash
npm run audit:command-center
```

Esse teste valida:

- isolamento da telemetria interna;
- `304` como resposta bem-sucedida e sem corpo;
- bytes de entrada por rota;
- existência de runtime pressure;
- existência de runbook operacional;
- existência de status SLO.

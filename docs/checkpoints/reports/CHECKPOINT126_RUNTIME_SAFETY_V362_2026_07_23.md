# Checkpoint 126 — segurança de runtime v362

## Escopo

O Proxy `21.12.394-runtime-safety-v362` é pareado ao APK v534 e preserva o protocolo móvel `2026.07.10.10` e o schema de entrega `4`.

## Melhorias

- JSON capturado remove campos e valores sensíveis, incluindo credenciais, e-mails e CPF;
- limites de documentos, bytes, tarefas, cache DNS e pools HTTP são normalizados e não podem ser desativados por `NaN` ou configuração inválida;
- coletor de rede possui backpressure, prazo de settle e bloqueio de gravações tardias;
- sandbox local, bloqueio de downloads/popups/WebSockets/Service Workers e endereço real obrigatório permanecem ativos;
- `/scrape` e o fetch direto seguem redirecionamentos manualmente, com HTTPS, allowlist e resolução DNS pública verificados em cada salto;
- loops, excesso de redirecionamentos, caminhos/parâmetros sensíveis e mudança para host privado ou não permitido são recusados;
- respostas da rota `/scrape` limitam texto e HTML e não expõem query strings em diagnósticos;
- cache DNS usa LRU e pools HTTP restaurados de estado legado recebem contadores válidos.

## Compatibilidade

O APK continua aceitando checkpoints 123 e 125 e Proxies sem manifesto. Quando o Proxy anuncia o checkpoint 126, o APK exige também as proteções de redirecionamento nativo e direto. Dados dinâmicos continuam apenas preenchendo lacunas e nunca sobrescrevem valores financeiros válidos.

## Validação

- build Vercel-safe aprovado;
- sintaxe aprovada em 409 arquivos JavaScript;
- 150/150 módulos alcançáveis;
- suíte isolada: 260 arquivos, 146 aprovados, 114 bloqueados por dependências ausentes, zero falhas;
- cross-stack: 39 arquivos, 22 aprovados, 17 bloqueados, zero falhas;
- APK: 216 arquivos Kotlin auditados, validação integral aprovada e migração Room 12→13 validada com 20.000 transações.

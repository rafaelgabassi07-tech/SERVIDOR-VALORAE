# Validação APK–Proxy — v618 / 2026-08-07

## Proxy 21.12.404

- build Vercel-safe: aprovado;
- sintaxe: 427 JavaScript;
- importação sob demanda: fetch=0, interval=0, timeout=0;
- runtime reachability: 152/152;
- SQL mínimo: aprovado;
- consistência de versão: aprovada;
- suíte geral: 172 aprovados, 100 bloqueados, 0 falhas;
- cross-stack com `VALORAE_APK_ROOT` apontando para o fonte v618: 26 aprovados, 17 bloqueados, 0 falhas.

Bloqueios por dependências ausentes no pacote local:

- `cheerio`: 99 testes gerais e 16 cross-stack;
- `undici`: 1 teste geral e 1 cross-stack.

Nenhum bloqueio foi contabilizado como aprovação e nenhuma falha funcional permaneceu.

# Validação APK–Proxy — v613 / 2026-08-07

Pareamento: APK `2026.08.07.04` / Proxy `21.12.404`.

Validações aprovadas:

- build Vercel-safe;
- sintaxe de 427 arquivos JavaScript;
- importação sob demanda sem fetch/interval/timeout no import;
- runtime reachability 152/152;
- SQL mínimo;
- consistência de versão;
- suíte geral: 172 aprovados, 100 bloqueados por dependências ausentes, 0 falhas;
- cross-stack com `VALORAE_APK_ROOT` apontando à fonte v613: 26 aprovados, 17 bloqueados, 0 falhas.

Bloqueios conhecidos e não introduzidos pelo CP12:

- `cheerio`: 99 testes gerais / 16 cross-stack;
- `undici`: 1 teste geral / 1 cross-stack.

Nenhum contrato público foi alterado.

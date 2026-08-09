# Validação APK v622 / Proxy 21.12.404

- build Vercel-safe: aprovado;
- sintaxe: 427 arquivos JS;
- imports sob demanda: fetch=0, interval=0, timeout=0;
- runtime reachability: 152/152;
- SQL mínimo: aprovado;
- consistência de versão com APK real: aprovada;
- testes mobile alerts/background/daily close: aprovados;
- suíte geral: 172 aprovados, 100 bloqueados por dependências ausentes, 0 falhas;
- cross-stack: 26 aprovados, 17 bloqueados por dependências ausentes, 0 falhas.

Bloqueios: `cheerio` (99 geral / 16 cross-stack) e `undici` (1 / 1).

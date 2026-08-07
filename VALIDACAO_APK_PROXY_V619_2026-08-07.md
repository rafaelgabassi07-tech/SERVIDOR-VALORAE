# Validação APK–Proxy v619

## Resultado local

- build Vercel-safe: aprovado
- sintaxe: 427 JS
- imports sob demanda: fetch=0 / interval=0 / timeout=0
- runtime reachability: 152/152
- SQL mínimo: aprovado
- version consistency: aprovado
- suíte geral: 172 aprovados / 100 bloqueados / 0 falhas
- cross-stack: 26 aprovados / 17 bloqueados / 0 falhas

Bloqueios são exclusivamente dependências locais ausentes (`cheerio` e `undici`). Instalação npm offline foi tentada e falhou por artefato não presente no cache.

## Limites de homologação

O projeto declara Node 24.x, mas o executor disponível é Node 22.16.0. Os endpoints publicados também não puderam ser consultados por falha de DNS do ambiente. Portanto, os resultados comprovam o pacote local, não o deploy remoto atual.

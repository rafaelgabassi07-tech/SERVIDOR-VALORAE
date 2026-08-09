# VALORAE Proxy v359 — mudanças de indicadores, limpeza e Monitor Gateway

Data: 2026-07-23

## Escopo

- pareamento com o APK v531 (`2026.07.23.03`);
- suporte visual ao bloco "O que mudou" dos modais de ações e FIIs;
- remoção de módulos sem consumidor comprovado;
- nova identidade visual e logotipo do Monitor Proxy Gateway;
- preservação do protocolo móvel `2026.07.10.10` e da migração financeira v358.

## Limpeza estrutural

Foram removidos 87 arquivos JavaScript que não eram alcançados pelo entrypoint Vercel, servidor local, scripts declarados, monitor ou testes vivos. A limpeza inclui rotas paralelas antigas, agregadores abandonados, utilitários sem consumidor e a implementação duplicada do monitor.

O gate `npm run audit:dead-code` agora:

1. constrói o grafo de imports do runtime e tooling declarado;
2. rejeita imports relativos sem arquivo de destino;
3. falha quando qualquer módulo JavaScript de produção deixa de ser alcançável.

## Monitor

- logotipo vetorial exclusivo com o `V` do VALORAE, nó central e conexões laterais de gateway;
- superfícies planas, hierarquia mais clara e menor ruído visual;
- temas claro e escuro com contraste adaptativo;
- cabeçalho, métricas, filtros, tráfego, saúde, benchmark e arquitetura responsivos;
- foco visível, navegação por teclado e `prefers-reduced-motion` preservados;
- PNGs 48, 192, 512 e 1024 regenerados a partir do SVG canônico.

## Validação

- build Vercel-safe aprovado;
- 392 arquivos JavaScript com sintaxe aprovada;
- grafo de runtime: 144/144 módulos alcançáveis;
- auditoria de versão aprovada para `21.12.392-extraction-intelligence-v360`;
- suíte integral: 136 aprovados, 113 bloqueados por dependências ausentes no ambiente, 0 falhas;
- suíte cross-stack: 22 aprovados, 16 bloqueados por dependências ausentes, 0 falhas;
- servidor local serviu monitor, SVG, CSS, JavaScript e health check com HTTP 200.

Os bloqueios correspondem a `cheerio` e `undici`, declarados no `package.json`, mas indisponíveis no ambiente auditado. Eles não foram classificados como testes aprovados.

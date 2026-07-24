# Checkpoint 123 — Inteligência de extração v360

## Resultado

O Proxy mantém a arquitetura mais adequada ao ambiente serverless do VALORAE: transporte HTTP e análise HTML como caminho primário, dados estruturados como segunda camada e Playwright opcional somente quando a cobertura estática é insuficiente.

## Melhorias

- reconhecimento de estados de Next.js, Nuxt, Remix, Apollo, Redux, SvelteKit e Astro sem `eval` ou execução de scripts;
- leitura limitada de atributos de hidratação e configurações de gráficos;
- captura de respostas JSON de XHR/fetch/document no contexto isolado do Playwright;
- restrição a HTTPS, hosts permitidos, status 2xx, conteúdo JSON e limites por documento e por execução;
- bloqueio de hosts locais, privados, reservados e IPv4 mapeado em IPv6;
- remoção de query strings, credenciais e fragmentos dos diagnósticos;
- ausência de persistência de headers, cookies ou corpos de requisição;
- deduplicação SHA-256;
- promoção apenas por preenchimento de campos ausentes.

## Compatibilidade

- Proxy: `21.12.392-extraction-intelligence-v360`;
- APK: v532 / `2026.07.23.03`;
- protocolo móvel preservado em `2026.07.10.10`;
- schema de entrega preservado na versão `4`;
- contrato aditivo `2026.07.23-checkpoint123-v1`;
- Proxies anteriores sem o novo header permanecem aceitos pelo APK.

## Validação

- build Vercel-safe aprovado;
- sintaxe aprovada em 399 arquivos JavaScript;
- 147/147 módulos JavaScript alcançáveis;
- suíte isolada: 253 arquivos, 139 aprovados, 114 bloqueados por dependências ausentes e 0 falhas;
- cross-stack: 39 arquivos, 22 aprovados, 17 bloqueados e 0 falhas;
- testes puros de captura, limites, deduplicação, bloqueio SSRF e contrato móvel aprovados.

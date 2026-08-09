# Proxy 21.12.404 — compatibilidade APK v643

APK pareado: `2026.08.09.06`.

A v643 concentra correções de UX/performance no APK. O Proxy não altera rotas, payloads, parser de rankings ou regras financeiras nesta release. A faixa de mercado já preservava os oito códigos canônicos (`USD`, `IFIX`, `IDIV`, `SMLL`, `CDI`, `IPCA`, `IBOV`, `IVVB11`); a alteração de runtime no Proxy limita-se a avançar `pairedVersion` e `maxTestedVersion`.

Validações da entrega:

- `npm run build`: aprovado.
- `npm run check:syntax`: aprovado em 440 arquivos JavaScript.
- `npm run audit:version`: aprovado.
- teste específico de compatibilidade v643: aprovado.
- contrato da faixa de mercado v641: aprovado.
- expansão de rankings v640: aprovada.
- suíte completa: 284 testes; 180 aprovados; 100 bloqueados por dependências opcionais (`cheerio`: 99, `undici`: 1); 4 falhas históricas já existentes na linha-base, todas em artefatos estáticos antigos (`ecosystem-map-site-v400/v401`, `public/inspector.html` e `server.html`).

Nenhuma das quatro falhas históricas é causada pela compatibilidade v643, e nenhum código de `lib/market/indices.js` foi alterado nesta release.

# Proxy 21.12.404 — compatibilidade APK v642

APK pareado: `2026.08.09.05`.

A v642 corrige somente estabilidade de preview/inspeção no APK. O Proxy não recebeu alteração de rota, parser, payload ou regra financeira nesta versão. A mudança de runtime no Proxy limita-se a avançar `pairedVersion` e `maxTestedVersion` para reconhecer o APK v642 como `PAIRED`.

O contrato da faixa de mercado permanece `analysis market ticker-v2` e o contrato de rankings permanece `semantic-v2`.

## Validação

- teste específico de compatibilidade v642: aprovado;
- `npm run build`: aprovado;
- auditoria de versão: aprovada;
- sintaxe JavaScript: aprovada;
- suíte completa: 283 testes, 179 aprovados, 100 bloqueados por dependências opcionais e as mesmas 4 falhas históricas da baseline anterior.

# Proxy v304 — Gateway universal e source budget

## Resultado
Release `21.12.336-asset-modal-gateway-source-budget-v304`, pareada ao APK v468.

## Alterações
- Nova rota /api/v1/asset/modal resolve Ação, unit ou FII no Proxy e mantém as rotas tipadas anteriores para compatibilidade.
- Classificação canônica do ticker prevalece sobre hints antigos conflitantes, evitando que TAEE11 e outras units terminadas em 11 sejam consultadas como FII.
- Capturas Investidor10 compartilhadas por fast/full usam orçamento mínimo de 6,5 segundos e uma tentativa adicional, enquanto o deadline curto do fast continua controlando a resposta ao APK.
- HTML fundamentalista de Ações e FIIs usa TTL alinhado de 10 minutos e stale de 8 horas; cotação e gráficos em tempo real permanecem em fontes/caches separados.
- Timeout do logo Yahoo de ações foi alinhado em 3,8 segundos para reduzir ausência de logos oficiais em redes lentas.
- Teste v304 valida roteamento funcional offline de PETR4, TAEE11 e MXRF11, conflito de hints, source budget, rota no manifest e integração estática com o APK v468.

## Validação
- npm run build
- npm run check:syntax — 367 arquivos JS
- npm test — 176 arquivos, 0 falhas
- npm run audit:version
- node test/asset-modal-gateway-source-budget-v304.test.js
- gateway offline: PETR4, TAEE11 e MXRF11
- Kotlin runtime/merge harness no APK
- unzip -t e teste do Proxy extraído isoladamente

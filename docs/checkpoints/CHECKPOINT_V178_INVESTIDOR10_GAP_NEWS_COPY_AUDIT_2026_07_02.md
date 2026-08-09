# Proxy v178 — Auditoria Investidor10, lacunas de informação e alinhamento APK

## Escopo
- Continuação da varredura do Investidor10 para ação e FII, com foco em blocos que a fonte exibe e que podiam não chegar completos ao APK.
- Reforço dos gráficos multi-série para evitar barras/linhas desalinhadas quando a fonte entrega mais de duas métricas.
- Alinhamento com o APK v293 para notificações de notícias em segundo plano com texto menos repetitivo e mais natural.

## Correções aplicadas no Proxy
- FIIs agora preservam narrativa curada de `Sobre o fundo`, `Estratégia e composição`, `Diversificação e exposição`, `Estrutura e taxas` e `Informações adicionais` quando esses blocos aparecem no Investidor10.
- A apresentação pública continua sem payload bruto, HTML cru, diagnóstico ou seletor técnico.
- Gráficos financeiros multi-série com `requireFullAlignment` não relaxam mais para períodos parciais; se a fonte não entregar períodos comuns suficientes, o contrato cai em gráfico seguro em vez de montar série visualmente quebrada.
- Adicionado teste regressivo `investidor10-source-gap-v178.test.js` cobrindo HGLG11 narrativo e alinhamento de séries financeiras.

## Alinhamento APK
- Compatível com APK v293, que refina textos de notificações de notícias para reduzir repetição de ticker/manchete e evitar descrições genéricas.

## Validação esperada
- `npm run verify`
- ZIP sem pasta wrapper, pronto para AI Studio.

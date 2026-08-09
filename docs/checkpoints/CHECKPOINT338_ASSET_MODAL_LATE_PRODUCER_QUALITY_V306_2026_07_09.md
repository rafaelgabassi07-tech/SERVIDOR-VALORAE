# Proxy 21.12.338 — Asset modal late producer quality v306

- O producer profundo continua registrado após o deadline HTTP e aquece o cache quando termina.
- Uma nova tentativa se conecta ao mesmo trabalho em andamento, sem duplicar capturas externas.
- Respostas `full` com deadline/`PARTIAL` deixam de se declarar finais.
- Contratos `full` com menos de 40% das seções não entram no cache estável.
- Extras REST, ranking e comunicados possuem espera limitada; o HTML já capturado entrega as seções profundas sem aguardar todas as fontes auxiliares.
- Cabeçalhos de captura anunciam navegador móvel e locale `pt-BR`.
- Pareado com APK v470 / Checkpoint 60.

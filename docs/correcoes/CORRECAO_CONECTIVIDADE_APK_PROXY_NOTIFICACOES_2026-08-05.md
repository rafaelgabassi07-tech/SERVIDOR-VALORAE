# Correção de conectividade APK ↔ Proxy e notificações — 2026-08-05

## Regressão investigada

A reformulação do monitor não alterou o roteador de runtime. A indisponibilidade ampla podia ocorrer quando variáveis antigas de implantação substituíam a identidade canônica do APK. Nesse cenário, gráficos, modais e workers recebiam HTTP 403 em todas as rotas de leitura.

## Correções no Proxy

- a identidade canônica embarcada no APK continua aceita mesmo quando existe override antigo no ambiente;
- o override permanece aceito adicionalmente, sem substituir o contrato oficial;
- `/api/v1/ready`, `/api/v1/mobile/alerts` e `/api/v1/mobile/daily-close` foram cobertos pelo teste de regressão;
- função `api/router.js` recebeu 60 segundos e 1024 MB no Vercel para acomodar contratos consolidados sem encerrar prematuramente.

## Validação cruzada

- os 17 endpoints chamados pelo APK estão presentes no roteador;
- headers de identidade, protocolo e versão permanecem alinhados;
- rota consolidada de alertas e fechamento diário passam com a identidade canônica mesmo diante de overrides antigos simulados.

# Prompt para integrar um app terceiro ao VALORAE Proxy

Você é um engenheiro sênior. Integre meu app ao VALORAE Proxy usando a URL base:

https://servidor-valorae.vercel.app

Objetivo:
- Consumir dados de ativos, carteiras, rankings e métricas em tempo real.
- Tratar erros de rede, cache, fonte parcial e timeout.
- Atualizar a interface do app consumidor sem travar a experiência do usuário.

Endpoints úteis:
- GET /api/health
- GET /api/ready
- GET /api/asset?ticker=PETR4
- GET /api/assets?tickers=PETR4,VALE3,ITUB4
- POST /api/portfolio/analyze
- GET /api/server/metrics

Requisitos:
- Criar um cliente HTTP reutilizável.
- Implementar retry progressivo.
- Implementar cache local opcional.
- Mostrar estados: carregando, online, parcial, erro e sem dados.
- Nunca expor chaves sensíveis no app cliente.
- Validar o contrato JSON antes de alimentar a carteira.

# Teste real no dashboard

A página **Teste Real** executa chamadas HTTP reais contra o próprio servidor implantado. Ela foi criada para validar se o Valorae Proxy está recebendo, respondendo e registrando tráfego corretamente.

## O que o teste executa

- `GET /api/health`
- `GET /api/ready`
- `GET /api/fields`
- `GET /api/openapi`
- `GET /api/asset?ticker=PETR4&mode=basic&view=compact`
- `POST /api/portfolio/analyze`

Todas as chamadas usam `X-Valorae-Client-Id: ui-selftest`, então devem aparecer nas páginas **Clientes**, **Tráfego**, **Entrega**, **Desempenho** e **Logs**.

## Observação

A chamada de ativo pode retornar `PARTIAL` se uma fonte externa estiver indisponível. Isso não significa que o canal Proxy falhou; significa que o endpoint respondeu e expôs a qualidade real dos dados disponíveis naquele momento.

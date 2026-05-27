# Integração de sites terceiros com o Valorae Proxy

O Valorae Proxy expõe uma API HTTP/JSON em `/api/*` para que sites, apps mobile, ERPs, BI e parceiros consumam dados sem acessar diretamente o núcleo do engine.

## URL base

Em produção no Vercel, use:

```txt
https://SEU-PROJETO.vercel.app/api
```

No servidor local:

```txt
http://localhost:3000/api
```

## Headers recomendados

```http
X-Valorae-Client-Id: nome-estavel-do-app
Accept: application/json
```

O header `X-Valorae-Client-Id` é importante porque aparece na página **Clientes** do dashboard e permite diferenciar mobile, web, BI e parceiros.

## Exemplo JavaScript

```js
const VALORAE_PROXY_URL = 'https://SEU-PROJETO.vercel.app/api';

async function consultarAtivo(ticker) {
  const url = `${VALORAE_PROXY_URL}/asset?ticker=${encodeURIComponent(ticker)}&mode=basic&view=compact`;
  const response = await fetch(url, {
    headers: {
      'X-Valorae-Client-Id': 'site-terceiro-producao',
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`Valorae Proxy HTTP ${response.status}`);
  return response.json();
}
```

## Endpoints principais

- `GET /api/health`: saúde do servidor.
- `GET /api/ready`: prontidão operacional.
- `GET /api/asset?ticker=PETR4&mode=basic`: consulta de ativo.
- `POST /api/portfolio/analyze`: análise de carteira.
- `GET /api/fields`: catálogo de campos.
- `GET /api/openapi`: contrato de integração.
- `GET /api/observability?minutes=60`: métricas reais do Proxy.

## Observability

O dashboard mede status HTTP, método, rota, latência, bytes, content-type, client id, CORS/origin e eventos recentes. O app não armazena corpo de resposta, segredos ou IP bruto.

Em Vercel/serverless, as métricas são em memória por instância e podem reiniciar. Isso é intencional para manter o projeto compatível com o plano gratuito.

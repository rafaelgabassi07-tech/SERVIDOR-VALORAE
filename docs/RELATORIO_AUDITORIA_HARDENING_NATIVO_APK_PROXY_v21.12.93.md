# Auditoria e hardening nativo do Valorae Proxy v21.12.93

## Objetivo
Fortalecer o Valorae Proxy para integração simples com Web/APK Android, mantendo o projeto sem dependências obrigatórias novas, sem serviços externos obrigatórios e sem identidade de terceiros no código ou na documentação interna.

## Alterações aplicadas

1. **Cliente HTTP nativo estável**
   - Novo módulo `lib/http/native-adaptive-fetch.js`.
   - Cabeçalhos normalizados e sem headers perigosos (`host`, `content-length`, `transfer-encoding`, `proxy-*`).
   - Perfil de cliente controlado por `VALORAE_HTTP_CLIENT_PROFILE`, com opção `desktop` ou `android`.
   - Limite de corpo remoto por streaming para evitar estouro de memória em respostas grandes.

2. **Cache e revalidação mais fortes**
   - O fetch direto passa a armazenar validadores HTTP (`ETag` e `Last-Modified`) quando a fonte os fornece.
   - Requisições futuras podem usar `If-None-Match` e `If-Modified-Since`.
   - Resposta `304` reaproveita o HTML válido em cache, reduzindo tráfego e fragilidade.

3. **Retry com backoff e jitter**
   - Retentativas agora usam backoff exponencial com jitter controlado.
   - Isso reduz rajadas repetidas contra fontes instáveis e evita comportamento frágil em picos.

4. **Defesa SSRF reforçada**
   - URLs de scraping direto continuam limitadas a HTTPS e domínios permitidos.
   - URLs com credenciais embutidas são bloqueadas.
   - Hosts locais/privados continuam bloqueados.

5. **Identidade limpa**
   - Removidas referências textuais a projetos externos do pacote Valorae.
   - `scripts/audit-identity.js` valida que nomes externos não entram no código, documentação, testes, rotas, `metadata` ou `README`.

## Compatibilidade com APK Android

- O contrato das rotas não foi alterado.
- O app Android pode continuar consumindo JSON por `GET` ou `POST`.
- O proxy permanece compatível com TLS/HTTPS e CORS configurável.
- Para produção, recomenda-se manter `VALORAE_CORS_STRICT=true` e preencher `VALORAE_CORS_ALLOW_ORIGINS` com os domínios reais do app Web, quando existirem.
- Para APK nativo, prefira autenticação leve via `VALORAE_CLIENT_KEYS` e assinatura HMAC já suportada pelo proxy.

## Arquivos alterados

- `lib/http/native-adaptive-fetch.js`
- `lib/Valorae-engine.js`
- `lib/sources/fetch.js`
- `lib/contracts/mobile.js`
- `metadata.json`
- `.env.example`
- `scripts/audit-identity.js`
- documentação com referências externas sanitizadas

## Resultado

O Valorae Proxy ficou mais simples de integrar, mais resistente a fontes lentas/instáveis, menos propenso a estouro de memória com HTML grande e livre de nomes externos dentro do pacote.

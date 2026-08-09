# Auditoria de navegação de retorno — Monitor V-Proxy

Data: 2026-07-26  
Core: Proxy v363  
Monitor: v367, patch de navegação `backnav1`

## Resultado

A visão geral permanece como página raiz e não exibe retorno redundante. Todas as nove subpáginas reais do monitor agora possuem uma ação de retorno visível, com ícone, texto e alvo de toque mínimo de 44 px.

| Subpágina | Destino do botão |
|---|---|
| Tráfego | Visão geral |
| Detalhe da requisição | Tráfego |
| Rotas e contratos | Visão geral |
| Fontes e cache | Visão geral |
| Saúde operacional | Visão geral |
| Diagnósticos | Visão geral |
| Arquitetura | Visão geral |
| Benchmark | Visão geral |
| Ajustes | Visão geral |

## Compatibilidade legada

Os documentos `tests.html` e `inspector.html` agora redirecionam para `/monitor/diagnostics` e mantêm um link de retorno para a visão geral caso o redirecionamento automático seja bloqueado. Os aliases antigos `#tests` e `#inspector`, assim como os caminhos `/tests`, `/tests.html`, `/inspector` e `/inspector.html`, também são normalizados para Diagnósticos pelo runtime.

## Cache

A chave do Service Worker foi atualizada para `ui-v367-backnav1`, garantindo que navegadores que já instalaram o monitor recebam o HTML/JS corrigido sem alterar o contrato do APK ou a versão do núcleo do Proxy.

## Validação

- Teste dedicado de todas as subpáginas: aprovado.
- `index.html` e `server.html`: conteúdo idêntico.
- Área mínima de toque do retorno: 44 px.
- Rotas `/monitor/*`: HTTP 200 no servidor local.
- Build Vercel: aprovado.
- Sintaxe: 524 arquivos JavaScript aprovados.
- Suíte: 288 arquivos; 181 aprovados, 0 falhas e 107 bloqueados por dependências de scraping ausentes (`cheerio`/`undici`).
- Auditoria de versão: aprovada.

Nenhum contrato financeiro, rota da API, integração Supabase ou arquivo do APK foi alterado.

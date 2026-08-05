# Reformulação do monitor vertical APK ↔ Proxy — 2026-08-04

## Objetivo
Reduzir escala visual no mobile e apresentar o ciclo completo APK → Proxy → fontes → APK em uma linha vertical contínua, com leitura ampla, conexões explícitas e animações progressivas ao rolar.

## Alterações
- Cabeçalho compacto, logotipo reduzido e reposicionado.
- Tipografia, chips, ícones, superfícies e espaçamentos reduzidos no mobile.
- Fluxo reconstruído em dez etapas verticais conectadas.
- Todas as 17 rotas homologadas continuam documentadas.
- Ramificações de cache local, caminho remoto, fontes, qualidade e recuperação permanecem visíveis.
- Linhas e cartões usam animações CSS vinculadas à rolagem quando suportadas.
- Fallback integral sem animações: todo o conteúdo permanece visível.
- `prefers-reduced-motion` desativa os efeitos.
- CSP continua com `script-src 'none'` e `connect-src 'none'`.
- Monitor identificado como `vertical-flow-v403`.

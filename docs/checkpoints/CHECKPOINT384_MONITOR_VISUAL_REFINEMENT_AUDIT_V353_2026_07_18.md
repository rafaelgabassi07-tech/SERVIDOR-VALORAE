# Checkpoint 384 — Refinamento visual e auditoria corretiva do monitor (UI v353)

## Objetivo

Elevar a legibilidade e a consistência do monitor sem alterar os contratos consumidos pelo APK, e corrigir falhas de navegação, acessibilidade, atualização, exportação e cache do frontend operacional.

## Refinamento visual

- Superfícies, bordas, raios, espaçamento e hierarquia tipográfica foram padronizados.
- Métricas, filtros, timeline, detalhes, tabelas, benchmark, arquitetura e ajustes receberam layouts responsivos próprios.
- O fluxo de arquitetura passou a usar grade adaptativa, sem rolagem horizontal obrigatória.
- O benchmark apresenta todas as métricas em cartões no mobile, em vez de ocultar colunas fora da área visível.
- Estados claro e escuro preservam contraste sem gradientes, sombras decorativas ou efeitos de vidro.
- Cabeçalho e controles foram compactados para 320 px, mantendo alvos de toque e leitura do estado da conexão.

## Correções funcionais

- Drawer fica `inert` quando fechado e mantém foco preso enquanto aberto.
- Escape fecha o menu e o foco retorna ao acionador.
- Troca de página atualiza `aria-current` corretamente e leva foco ao conteúdo selecionado.
- Atualização manual informa operação concorrente, expõe estado ocupado e trata timeout de 12 segundos explicitamente.
- Mudança da origem da API limpa o snapshot remoto anterior para impedir exibição de dados obsoletos.
- Filtro de rotas consulta a janela analítica persistida quando disponível.
- Re-renderização da timeline preserva o evento focado.
- Tema atualiza `theme-color`, rótulos e estados ARIA.
- Exportação CSV neutraliza valores que poderiam ser interpretados como fórmula por planilhas.
- Cópia usa fallback compatível quando Clipboard API não está disponível.
- O Service Worker passou a ter ciclo completo de instalação, ativação e fetch, sem cachear `/api/`.

## Escopo preservado

- Nenhuma alteração nos endpoints ou contratos do APK.
- Nenhuma migração SQL adicional.
- Persistência Supabase e reconstrução analítica permanecem compatíveis com a tabela existente.

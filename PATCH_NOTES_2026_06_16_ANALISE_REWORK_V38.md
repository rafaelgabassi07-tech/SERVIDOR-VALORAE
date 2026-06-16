## 2026-06-16 — 21.12.122 — Revisão estrutural da página Análise

Patch: `21.12.122-analysis-page-rework-v38`

### Objetivo
Corrigir a página Análise para deixar de exibir informações técnicas/cruas ao usuário final e melhorar a fidelidade visual dos gráficos por tipo de dado.

### Mudanças
- Remove contagens técnicas como "pontos" dos itens de gráficos; o contrato passa a entregar período e último valor como leitura útil.
- Gráficos periódicos/discretos, como proventos, DY, payout, receitas/lucros, evolução patrimonial e demonstrativos, passam a ser classificados como barras ou barras agrupadas quando isso melhora a interpretação.
- Cotação histórica permanece em linha por representar evolução contínua.
- Comparadores de índices mantêm séries reais alinhadas e passam a poder gerar um gráfico agrupado "ativo x índices" quando há período comum suficiente.
- Campos financeiros zerados em "Sobre a empresa" deixam de ser tratados como dado válido.
- Seções sem fonte suficiente usam mensagem neutra de usuário final; termos técnicos como Proxy EMPTY não devem vazar para o APK.
- Balanço por período continua bloqueado quando não houver série real com pelo menos dois períodos.

### Regras preservadas
- Sem dado sintético.
- Sem HTML, iframe, WebView ou imagem externa.
- Página Análise segue no contrato `AnalysisPageResponse` em `/api/v1/analysis`.

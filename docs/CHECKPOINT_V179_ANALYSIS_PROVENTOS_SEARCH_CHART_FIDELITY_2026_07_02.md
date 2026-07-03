# Checkpoint v179 — Analysis Proventos Search Chart Fidelity

Data: 2026-07-02  
Pacote: valorae_proxy_analysis_proventos_search_chart_fidelity_v179_AI_STUDIO_ROOT_OK_2026_07_02.zip  
Versão pública: 21.12.209  
Release patch: 21.12.209-analysis-proventos-search-chart-fidelity-v179

## Objetivo

Aplicar auditoria e reforço no Proxy para reduzir lacunas vindas do Investidor10, principalmente nos gráficos e blocos usados pela página Análise e pelos modais dos ativos no APK.

## Ajustes aplicados

- Ampliação da descoberta de endpoints de gráficos do Investidor10.
- Inclusão de tentativas estruturadas para DRE/resultado, fluxo de caixa, indicadores históricos, cotação x lucro, receitas/lucros, balanço e proventos.
- Inclusão de endpoints adicionais para FIIs, incluindo dividend yield, distribuição de ativos e lista de imóveis quando identificáveis na fonte.
- Reclassificação mais forte dos papéis dos gráficos para evitar mapas genéricos e omissão de blocos.
- Aumento controlado do limite de URLs descobertas para preservar cobertura sem degradar demais o tempo de resposta.
- Ajuste de timeout das chamadas extras para reduzir falhas por resposta lenta da fonte.

## Contrato esperado para o APK

O Proxy continua entregando os dados via contrato único da Análise, mantendo a página Análise e os modais do ativo como consumidores do mesmo conjunto canônico de informações.

## Validação

Executar:

```bash
npm run verify
```


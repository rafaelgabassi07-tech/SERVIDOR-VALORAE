# Patch 21.12.111 — Checkpoint 31: Sobre Empresa/Fundo na Análise

Data: 2026-06-16

## Objetivo

Completar a seção `company_profile` do contrato único `/api/v1/analysis`, entregando descrição e dados cadastrais reais para empresas e fundos imobiliários.

## Implementação

- Empresas: descrição, setor, subsetor, segmento, CNPJ, site, atividade principal, governança, tag along, free float, número de ações, valor de mercado e patrimônio líquido.
- FIIs: descrição, razão social, CNPJ, administrador, gestor, segmento, tipo de fundo, mandato, tipo de gestão, prazo, taxa de administração e público-alvo.
- Normalização aceita dados vindos de `companyInfo`, `empresa`, `fundo`, `profile`, `results.dadosEmpresa`, `results.informacoesEmpresa`, `results.informacoesFundo`, `results.cadastroEmpresa`, `results.cadastroFundo` e `assetChartBundle.companyProfile/fundProfile`.
- A seção continua vazia quando não houver dado cadastral real.

## Segurança de contrato

- Mantido endpoint oficial `/api/v1/analysis`.
- Mantido contrato `AnalysisPageResponse` e `contractVersion = 26.analysis.v2`.
- Sem HTML, iframe, WebView, imagens externas ou dados simulados.
- Contratos antigos permanecem preservados para outros modais.

## Validação

- `npm run check`
- `npm test`
- Novo teste: `analysis-company-profile-v31.test.js`

# Proxy VALORAE 21.12.404 — compatibilidade APK v639

Data: 2026-08-09  
APK pareado: `2026.08.09.02`

## Alteração funcional

Nenhuma rota, endpoint, payload, parser, regra financeira ou contrato de mercado foi alterado. A mudança de runtime no Proxy é limitada a `pairedVersion` e `maxTestedVersion`, avançados para `2026.08.09.02`.

## Higiene documental

Foram removidas quatro cópias byte-idênticas de `docs/archive/`, mantendo as versões equivalentes em `docs/relatorios/`:

- `AUDIT_VALORAE_PROXY.md`;
- `AUDIT_ANALYSIS_VALUE_SCALE_PROXY_V146_2026_06_28.md`;
- `AUDIT_ANALISE_CLEAN_MOBILE_V47_2026_06_16.md`;
- `AUDIT_APK_PROXY_CONTRACT_HARDENING_V115_2026_06_23.md`.

Documentos únicos e documentação operacional permaneceram intactos. `README.md`, `CONTRIBUTING.md`, `SECURITY.md` e arquivos em `public/downloads/` foram preservados por terem função estrutural ou de distribuição.

## Organização documental

Relatórios novos desta entrega permanecem dentro de `docs/`; nenhum relatório de validação foi criado solto na raiz do Proxy.

## Validação

- `node test/apk-v639-compatibility.test.js`: aprovado.
- `node scripts/check-syntax.js`: **435 arquivos JS** aprovados.
- `node scripts/audit-version-consistency.js`: aprovado.
- `npm run build`: aprovado para Vercel.
- Suíte completa v639: **279 testes, 175 aprovados, 100 bloqueados e 4 falhas históricas**.
- Baseline recebida: **278 testes, 174 aprovados, 100 bloqueados e as mesmas 4 falhas**.

Portanto, a v639 adiciona um teste aprovado e não introduz regressão na suíte do Proxy.

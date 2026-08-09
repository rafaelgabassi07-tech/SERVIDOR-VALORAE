# Checkpoint 386 — integridade de patrimônio, checklist FII e política de logotipos

Manutenção v355 sobre o Proxy 21.12.382, pareada ao APK v529 / Checkpoint 121.

## Contratos corrigidos

- Histórico de carteira expõe `completeValuation`, `partialValuation`, cobertura, contagens e tickers sem cotação.
- O ponto atual usa somente cotações reais; custo médio não é promovido a preço atual.
- O checklist FII reconcilia IDs/rótulos legados com oito critérios canônicos.
- DY médio de 24 meses exige 24 meses mensais únicos.
- O modal FII não solicita logo ao Yahoo e retorna política explícita de ausência de logotipo oficial.
- `/api/v1/asset/logo` responde `NOT_APPLICABLE`/204 para FIIs sem iniciar consulta externa.
- Ações e units, inclusive tickers terminados em 11, continuam usando a política normal de logos quando classificados como ações.

## Validação

- build Vercel: aprovado;
- sintaxe: 471 arquivos JavaScript;
- suíte integral: 245 arquivos de teste, zero falhas;
- cross-stack: 38 testes, zero falhas;
- auditoria de versão: aprovada.

Nenhuma migração SQL foi adicionada.

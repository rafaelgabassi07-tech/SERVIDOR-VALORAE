# Auditoria Checkpoint 31 — Sobre Empresa/Fundo

Data: 2026-06-16
Patch: `21.12.111-analysis-company-profile-v31`

## Escopo

A seção `company_profile` foi reforçada para entregar dados textuais e cadastrais reais no contrato único da página Análise.

## Campos cobertos

### Ações

- descrição da empresa;
- setor;
- subsetor;
- segmento;
- CNPJ;
- site;
- atividade principal;
- governança;
- tag along;
- free float;
- número de ações;
- valor de mercado;
- patrimônio líquido.

### FIIs

- descrição do fundo;
- razão social;
- CNPJ;
- administrador;
- gestor;
- segmento;
- tipo de fundo;
- mandato;
- tipo de gestão;
- prazo;
- taxa de administração;
- público-alvo.

## Regras

- A seção só fica `ready` quando houver `items[]` reais.
- Dados ausentes não são simulados.
- O APK continua apenas renderizando JSON estruturado.

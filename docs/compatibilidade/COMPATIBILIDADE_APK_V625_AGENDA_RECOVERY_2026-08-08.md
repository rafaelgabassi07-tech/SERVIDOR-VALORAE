# Compatibilidade APK v625 / Proxy 21.12.404

Pareamento validado em 2026-08-08:

- APK: `2026.08.08.03` / v625.
- Proxy público: `21.12.404`.
- Release patch preservado: `21.12.404-account-profile-v413`.
- Protocolo móvel: `2026.07.10.10`.

## Hotfix de Agenda

O modo `source=home-agenda-recovery` usa a fonte primária por ticker e desativa o calendário público na recuperação. A assinatura de cache passa a incluir `source` e `includeCalendar`, impedindo que uma resposta degradada da consulta completa seja reutilizada indevidamente pela recuperação leve.

Nenhum endpoint financeiro foi renomeado e o esquema do payload permanece retrocompatível.

## Validação

- Build Vercel aprovado.
- 427 arquivos JS aprovados no check de sintaxe.
- Auditorias on-demand, SQL e versão aprovadas.
- Suíte completa no mesmo estado da baseline: 168 aprovados, 100 bloqueados por dependências ausentes e 4 falhas preexistentes de higiene/monitor.

# Proxy v165 — Hints para notificações profissionais

Versão: 21.12.195
Patch: `21.12.195-notification-deeplink-title-hints-v165`

## Ajustes

- `/api/v1/news` passa a enriquecer cada item com `notificationTopic`, `notificationTitleHint`, `notificationOpenUrl` e `notificationReason`.
- O contrato mantém compatibilidade com o APK atual porque os campos antigos continuam intactos.
- Os novos campos ajudam o APK a montar notificações com títulos mais profissionais e direcionamento mais confiável para a URL original.

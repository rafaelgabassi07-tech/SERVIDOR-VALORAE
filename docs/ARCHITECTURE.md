# Arquitetura VALORAE Proxy v21.13.0

O Proxy foi reconstruído para reduzir fan-out, remover cadeias de fallback escondidas e expor um contrato principal para o APK:

```text
/api/v1/mobile/portfolio-sync
```

As rotas legadas essenciais permanecem como aliases leves e previsíveis. Elas não chamam uma cadeia de fallback pesada: retornam o mesmo contrato centralizado ou blocos calculados diretamente.

## Regra de proventos

- Data Com ou Data Ex anterior ao pregão define elegibilidade.
- Data de pagamento define Agenda ou Evolução.
- Fonte por ticker para eventos confirmados.
- Agenda pública como complemento para eventos futuros/provisionados.

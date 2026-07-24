# Checkpoint 125 — hardening de extração e endereço real

Versões pareadas: Proxy v361 (`21.12.393-extraction-hardening-v361`) e APK v533 (`2026.07.23.04`).

## Mudanças

- descoberta estática de registros JSON estritos em frames React Flight/Next.js App Router, sem `eval`, VM ou execução de scripts;
- rejeição de hosts privados/especiais em endpoints descobertos;
- resolução DNS pública antes da navegação Playwright;
- validação de `Response.serverAddr()` quando disponibilizado pelo navegador;
- tratamento de IPv4 mapeado/encapsulado em IPv6;
- captura JSON continua limitada, deduplicada e somente aditiva;
- contrato novo `2026.07.23-checkpoint125-v1`, com aceitação retrocompatível do checkpoint 123.

## Garantias preservadas

- protocolo móvel `2026.07.10.10`;
- schema de entrega `4`;
- navegador opcional;
- campos financeiros válidos não podem ser sobrescritos por candidatos estruturados ou dinâmicos.

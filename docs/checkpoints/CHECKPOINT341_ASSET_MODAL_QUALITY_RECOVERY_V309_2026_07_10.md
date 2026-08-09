# Checkpoint 341 — Asset modal quality recovery v309

Release pública `21.12.341`, patch `21.12.341-asset-modal-quality-recovery-v309`, pareada ao APK v473.

## Mudanças

- Perfil de qualidade para Ação e FII, com completude e contagem de seções profundas.
- Cache full apenas para contratos expandidos.
- Recovery/resume ignora cache mas reutiliza producer ativo.
- Delivery v2 marca full básico como não final e retryable.
- Comparador de índices da ação possui espera limitada no full.
- Testes cruzados verificam recuperação, não duplicação, filtros da Análise e dropdown Classes.

## Compatibilidade

Nenhum endpoint ou campo anterior foi removido. Os metadados de qualidade são aditivos.

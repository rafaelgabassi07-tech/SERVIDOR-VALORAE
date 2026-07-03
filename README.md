# VALORAE Proxy — v197 — comparação com índices visível no modal de FIIs

Public version: 21.12.227  
Patch: `21.12.227-fii-modal-index-visibility-v197`  
Checkpoint: `fii-modal-index-visibility-v197`

Proxy v197 acompanha o APK v316: o modal único de FIIs mantém o bloco **Comparação com índices** visível mesmo quando o Yahoo retorna histórico parcial. O contrato FII evoluiu para `26.asset-modal.fii.v5` e tenta intervalos alternativos do próprio Yahoo para IFIX.SA, IDIV.SA e SMLL.SA antes de devolver estado parcial.

Pacote limpo para deploy/AI Studio com arquivos diretamente na raiz do ZIP.

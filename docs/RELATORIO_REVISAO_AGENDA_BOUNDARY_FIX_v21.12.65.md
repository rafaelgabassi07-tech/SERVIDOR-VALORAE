# Revisão independente — Agenda de Dividendos / Evolução de Proventos

## Resultado
A revisão encontrou que a implementação anterior estava funcional em cenários simples, mas ainda havia um risco no parser compacto do Investidor10: quando dois cards vinham colados em uma única linha, um regex fallback poderia associar o valor do card anterior ao ticker seguinte.

## Correção v21.12.65
- O parser compacto passou a segmentar o texto por ticker antes de extrair Data Com, Pgto, tipo e valor.
- O fallback `value-before-ticker` agora rejeita matches quando a janela anterior já contém `Data Com` ou `Pgto`, evitando capturar o final do card anterior como se fosse um novo card.
- Foram adicionados testes para impedir regressão nos casos:
  - FISC11 R$ 0,62 seguido de FATN11 R$ 0,80 não pode gerar FATN11 R$ 0,62.
  - Evento provisionado sem data de pagamento explícita, como ABEV3 com `Pgto Provisionado JSCP`, deve ser preservado.

## Validações executadas
- `node --check` nos arquivos alterados do Proxy.
- `node scripts/audit-version-consistency.js`.
- `npm test -- --runInBand`.

Resultado final: 91 arquivos de teste executados, 0 falhas.

## APK
O APK v2.0.28 foi revisado novamente. A lógica de UI/analytics continua compatível com o contrato do Proxy:
- usa `portfolio/next-dividends` e fallbacks por ativo;
- filtra a agenda futura por data de pagamento/data-com;
- usa histórico pago/recebido para evolução de proventos;
- aplica saneamento por carteira no ViewModel antes de expor `analytics.dividendEvents`.

Não foi necessário alterar o APK nesta revisão. A atualização necessária é o Proxy v21.12.65.

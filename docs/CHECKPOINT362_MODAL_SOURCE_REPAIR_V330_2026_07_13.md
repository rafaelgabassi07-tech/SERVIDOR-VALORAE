# Proxy 21.12.362 — Reparo das fontes dos modais

Release `21.12.362-modal-source-repair-v330`, pareada ao APK `v510` / Checkpoint 100.

## Fontes e contratos reparados

- `Comparando com outros FIIs`: a página do ativo fornece a URL da API do comparador; a resposta estruturada entrega `type`, `segment`, `P/VP`, `Dividend Yield` e patrimônio por fundo.
- `Checklist do investidor`: o parser lê os inputs marcados e desmarcados no HTML original e anexa fonte, URL, evidência e natureza `DIRECT` a cada item.
- `Payout`: a API retorna um objeto indexado internamente; o lucro agora é associado pelo campo `year` contido no registro, recuperando a série retroativa correta.
- `Comparação com índices`: IBOV, IFIX, SMLL e IDIV usam a API de cotações dos próprios índices e preservam somente pontos reais. ETFs, proxies e interpolação permanecem proibidos.

## Entrega móvel

- `peerComparison`, `checklist` e `payoutChart` têm prontidão própria e são alvos de recuperação dirigida; uma falha opcional não invalida as demais seções do modal.
- O modal completo recebe orçamento de até 22 segundos no runtime e chamada móvel de até 30 segundos.
- Ativo, índices e séries macroeconômicas são iniciados em paralelo.
- Estados vazios, falhos e adiados continuam explícitos; nenhum valor é fabricado.

## Validação

- Fontes reais verificadas com MXRF11 e PETR4.
- Testes de parser cobrem checklists, pares, Payout e IDs/históricos dos índices.
- `npm run verify` e a suíte cross-stack validam o pacote final em conjunto com o APK v510.

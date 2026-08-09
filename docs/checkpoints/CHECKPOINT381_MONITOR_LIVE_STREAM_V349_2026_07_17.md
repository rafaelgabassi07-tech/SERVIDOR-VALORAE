# Checkpoint 381 — monitor plano de tráfego ao vivo (Proxy v349)

Data: 2026-07-17  
Contrato móvel preservado: `2026.07.10.10`  
Observabilidade aditiva: `2026.07.17-checkpoint119-v1`

## Resultado executivo

O monitor antigo misturava operação, documentação, arquitetura, benchmark e controles em uma interface com sidebar e muitos blocos visuais. A renovação concentra a operação diária em quatro superfícies planas: tráfego ao vivo, rotas/fontes, saúde e ajustes.

O Proxy continua sendo a fonte de verdade. O painel não reconstrói eventos no navegador: ele consulta o snapshot central, ignora o próprio polling nos totais externos e apresenta as respostas que efetivamente saíram da instância.

## Tráfego exibido

Cada resposta externa pode informar método, rota, status, horário, latência, bytes de entrada e saída, tipo de conteúdo, consumidor, versão/canal, ticker, view, fonte, cache, região, request ID, caminho do interceptador, raízes e sinais do payload e uma prévia limitada do corpo.

Requisições ainda em processamento aparecem separadamente com idade, rota, método, consumidor, bytes recebidos e contexto sanitizado. HEAD, OPTIONS, streaming, respostas diretas e encerramentos do cliente permanecem cobertos pelo interceptador central.

## Privacidade e segurança

- IP bruto e hash do cliente não são entregues ao monitor;
- corpo da requisição não é armazenado nem exibido;
- nomes de query podem aparecer para auditoria de formato;
- valores só aparecem para uma allowlist explícita de parâmetros funcionais não secretos;
- tokens, chaves e valores arbitrários permanecem ocultos;
- a prévia de resposta continua limitada e pode ser desativada por ambiente.

## Renovação visual

- removidos sidebar, cards decorativos, gradientes, blur e sombras de elevação;
- removidas páginas de arquitetura, tecnologia, documentação e benchmark da interface operacional;
- hierarquia baseada em tipografia, divisores finos e densidade controlada;
- layout adaptado para desktop, tablet e celular;
- temas claro, escuro e sistema, foco visível e movimento reduzido;
- filtros, pausa, atualização manual, JSON/CSV e snapshot técnico mantidos.

Os assets de arquitetura que deixaram de ser usados foram retirados. A carga não comprimida da interface caiu de aproximadamente 124.739 bytes no v348 para 70.253 bytes no v349, redução de 43,68%.

## Compatibilidade

Nenhuma rota, campo financeiro, header móvel, ETag, schema ou política de cache foi alterada. O APK v528 continua consumindo as mesmas estruturas do Proxy 21.12.380; a versão 21.12.381 adiciona somente observabilidade e a nova interface do monitor.

## Validação

- testes dedicados de captura central e sanitização de query;
- teste sintático do runtime separado do HTML;
- QA DOM de navegação, filtros, temas, detalhe, rotas, saúde e snapshot;
- build Vercel-safe, 237 arquivos de teste do Proxy, auditoria de versão e 37 testes cross-stack;
- instalação limpa do pacote final antes da entrega.

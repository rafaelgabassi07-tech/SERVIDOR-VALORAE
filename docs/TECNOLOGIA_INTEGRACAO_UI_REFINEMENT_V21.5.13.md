# Valorae Proxy v21.5.13 - Refinamento de Tecnologia e Integração

## Ajustes aplicados

- Botão de Configurações movido para o cabeçalho, ao lado do alternador de modo claro/escuro.
- Rodapé lateral deixou de ser botão; agora é apenas identificação compacta de produto/status.
- Página Tecnologia renomeada para **Tecnologia e Integração**.
- Página Tecnologia e Integração ampliada com:
  - fluxo app terceiro -> Proxy -> engine -> scraping -> JSON;
  - explicação das camadas do Proxy;
  - detalhes de scraping VALORAE e tratamento de `PARTIAL`;
  - coordenadas atuais de integração;
  - headers obrigatórios e recomendados;
  - prompt completo para IA implementar o Proxy em apps terceiros;
  - downloads de prompt, coordenadas JSON, `.env.example` e guia completo.
- Adicionados arquivos estáticos em `public/downloads/` como backup offline/estático.
- Service Worker atualizado para cachear o shell PWA e materiais de integração, sem cachear `/api/*`.

## Observações

Os downloads gerados pelos botões da página usam a URL real do deploy atual em runtime. Os arquivos estáticos em `public/downloads/` usam placeholders para funcionar como modelos reutilizáveis.

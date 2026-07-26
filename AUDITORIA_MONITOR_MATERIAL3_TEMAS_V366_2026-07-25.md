# VALORAE — Monitor V-Proxy Material 3 e temas v366

Data: 25/07/2026

## Resultado

O monitor do V-Proxy foi migrado para uma linguagem visual baseada em Material 3 e alinhado ao catálogo de aparência do APK Valorae. A alteração é restrita ao Proxy; o APK não precisou ser modificado.

## Aparência compatível com o APK

### Modos

- Sistema
- Claro
- Escuro

O modo Sistema acompanha `prefers-color-scheme` e reage quando a preferência do sistema muda enquanto o monitor está aberto.

### Paletas

1. Ouro Classic
2. Coral Solar
3. Turquesa Oceano
4. Grafite Mineral
5. Azul Safira
6. Esmeralda Verde
7. Lírio Ametista
8. Vermelho Rubi
9. Cacau Bronze

Cada paleta altera a hierarquia completa de cores: primária, containers, superfícies, texto, contornos, estados e componentes. Não se limita à cor de destaque.

### Preferências adicionais

- Densidade Confortável ou Compacta
- Movimento Padrão ou Reduzido
- Persistência local no navegador
- Migração da preferência de tema antiga

## Material 3

Foram aplicados:

- tokens de cor e superfícies tonais;
- cartões com elevação tonal e formas amplas;
- botões filled, tonal e text;
- navegação em pills;
- controles segmentados;
- chips e campos consistentes;
- estados de hover, foco e pressão;
- tipografia e espaçamento responsivos;
- suporte a `prefers-reduced-motion`;
- foco visível e semântica dos controles preservados.

## Responsividade

- Sidebar adaptativa em dispositivos móveis;
- paletas em uma coluna em telas estreitas;
- nenhum overflow horizontal em viewport de 390 px;
- rótulo de última atualização truncado sem quebrar o layout;
- densidade compacta reduzindo a barra superior para 62 px;
- conteúdo operacional e tabelas preservados.

## Arquivos principais alterados

- `public/index.html`
- `public/server.html`
- `public/monitor-valorae.css`
- `public/monitor-valorae.js`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `package.json`
- `metadata.json`
- `README.md`
- testes de contrato e interface do monitor

`index.html` e `server.html` permanecem idênticos.

## Validação

### Navegador real

- 9 paletas alternadas com sucesso;
- 3 modos de aparência reconhecidos;
- persistência gravada em `localStorage`;
- densidade compacta aplicada;
- movimento reduzido aplicado;
- menu móvel funcional;
- grid móvel em uma coluna;
- overflow horizontal: 0 px;
- exceções JavaScript: 0;
- mensagens de erro no console: 0.

### Projeto

- 504 arquivos JavaScript aprovados na verificação sintática;
- build Vercel aprovado;
- auditoria de versão aprovada;
- auditoria de alcance do runtime aprovada;
- 269 arquivos de teste executados;
- 162 testes aprovados;
- 107 testes bloqueados apenas pela ausência local das dependências declaradas `cheerio` e `undici`;
- 0 falhas.

## Supabase e comportamento operacional

A alteração visual não reativa persistência de telemetria. O monitor continua em memória, sem gravar eventos no Supabase. Nenhuma variável nova é necessária na Vercel para usar os temas.

## Limitações

O navegador de validação precisou receber o documento por CDP devido à política do ambiente bloquear URLs locais. O HTML, CSS e JavaScript usados foram os arquivos reais do projeto. Imagens externas não foram avaliadas nesse modo, mas os recursos de marca do pacote não foram alterados.

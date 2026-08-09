# VALORAE — Auditoria profunda da página Patrimônio Total

Data: 25/07/2026  
APK: v541 (`2026.07.25.04`, versionCode `26072504`)  
Proxy: `21.12.394-runtime-safety-v362`, extensão de histórico patrimonial v367  

## Escopo

A auditoria cobriu a página Patrimônio Total de ponta a ponta:

- construção mensal da evolução patrimonial;
- tratamento de compras, vendas, aportes, retiradas e proventos;
- gráfico em linha e barras;
- modos monetário (R$) e percentual (%);
- seleção de mês, período e classe de ativo;
- retorno da carteira, CDI, diferença em pontos percentuais, Sharpe, volatilidade e drawdown;
- concentração e insights executivos;
- lacunas de histórico e estados vazios;
- requisições do APK ao Proxy para retornos e benchmarks;
- período “Desde o início”.

## Regressões confirmadas

### 1. O modo percentual mudava a natureza da série

O seletor `%` não convertia a evolução patrimonial para percentual. Ele substituía a curva por retornos mensais, portanto o usuário comparava grandezas diferentes ao alternar R$ e %.

**Correção:**

- Linha + R$: patrimônio total e valor aplicado.
- Linha + %: rentabilidade acumulada de mercado.
- Barras + R$: ganho ou perda de mercado em cada mês.
- Barras + %: retorno de mercado de cada mês.

### 2. “Retorno sem aportes” exibia fluxo líquido

O campo descrito como retorno usava aportes menos retiradas, que é movimentação financeira e não desempenho.

**Correção:** resultado de mercado, fluxo líquido, aportes, retiradas e variação bruta agora são métricas separadas e nomeadas corretamente.

### 3. Aportes e retiradas distorciam rentabilidade

O retorno mensal não ponderava adequadamente a data da movimentação. Um aporte próximo ao fim do mês podia reduzir artificialmente o retorno; uma retirada podia parecer prejuízo.

**Correção:** cálculo mensal com fluxo líquido ponderado pelo tempo dentro do mês, seguindo uma abordagem Modified Dietz. O denominador considera quanto tempo cada fluxo ficou exposto ao mercado.

### 4. Lacunas eram tratadas como meses contínuos

Meses sem fechamento podiam ser ligados visualmente e gerar retorno entre pontos distantes.

**Correção:**

- retorno mensal só é válido entre meses adjacentes;
- linhas são interrompidas nas lacunas;
- o painel informa que há cobertura incompleta;
- o mês sem base anterior mostra retorno indisponível, sem inventar zero.

### 5. Escalas visuais fixas e inadequadas

O gráfico percentual usava escala mínima rígida, achatando carteiras de baixa volatilidade. As barras e legendas também não correspondiam às séries realmente desenhadas.

**Correção:** escala assinada e dinâmica, eixo zero real para barras, legendas específicas para cada combinação de estilo e unidade.

### 6. CDI de 12 meses comparado com outros períodos

Ao selecionar 6, 24, 36 meses ou desde o início, o painel ainda podia mostrar CDI de 12 meses.

**Correção:** o APK solicita o intervalo correspondente ao período selecionado, e o cálculo usa somente os mesmos meses válidos da carteira.

### 7. Drawdown calculado sobre patrimônio bruto

A queda máxima usava o saldo patrimonial. Retiradas podiam parecer drawdown e aportes podiam esconder perdas.

**Correção:** drawdown calculado sobre índice composto de retornos mensais de mercado, sem influência direta dos fluxos.

### 8. Indicadores ignoravam filtros da página

Concentração, melhor posição e risco podiam continuar usando a carteira inteira mesmo quando o usuário selecionava apenas Ações, FIIs, Exterior ou Outros.

**Correção:** série, estatísticas, concentração, insights, retorno e risco usam o mesmo filtro e o mesmo período da interface.

### 9. Seleção do mês se perdia durante atualizações

Atualizações de dados podiam reposicionar a seleção sem necessidade.

**Correção:** seleção e estilo do gráfico usam estado salvável; o mês só muda quando deixa de existir no novo conjunto.

### 10. “Desde o início” era limitado silenciosamente a dez anos

O Proxy convertia `SINCE_START` em 120 meses, ainda que a carteira fosse mais antiga.

**Correção:**

- período derivado da primeira transação válida;
- histórico mensal solicitado com `range=max`;
- CDI e benchmarks recebem a mesma janela;
- teto de segurança ampliado para 600 meses, respeitando a cobertura real das fontes.

## Funcionamento final

### Linha em R$

Mostra patrimônio total versus valor aplicado. O ganho ou perda não é confundido com aporte.

### Linha em %

Mostra rentabilidade acumulada de mercado. A linha é interrompida quando falta uma transição mensal válida.

### Barras em R$

Mostra resultado de mercado mensal, com ganhos acima de zero e perdas abaixo de zero.

### Barras em %

Mostra retorno mensal assinado, também ao redor do eixo zero.

### Painel do mês

Exibe, conforme disponibilidade:

- patrimônio/fechamento;
- valor aplicado;
- resultado de mercado;
- rentabilidade mensal;
- rentabilidade acumulada;
- fluxo líquido;
- aportes;
- retiradas;
- ganho ou perda total;
- variação bruta do saldo.

### Risco e performance

Usa o mesmo recorte do gráfico e informa quantos meses válidos sustentam o cálculo. CDI, diferença, Sharpe, volatilidade e drawdown deixam de misturar janelas incompatíveis.

## Arquivos principais alterados no APK

- `PatrimonyEvolutionCalculator.kt`
- `PatrimonyRiskCalculator.kt`
- `PatrimonyTotalModalComponents.kt`
- `PortfolioDashboardModalUi.kt`
- `PortfolioDashboardReturnsUi.kt`
- testes de evolução e risco
- metadados de release v541

## Arquivos principais alterados no Proxy

- `lib/portfolio/analysis.js`
- `lib/sources/asset-details.js`
- `lib/sources/cdi.js`
- metadados de pareamento APK v541
- teste de contrato `portfolio-returns-since-start-v367.test.js`

## Validação

- contrato dedicado Patrimônio Total: 13/13;
- 217 arquivos Kotlin estruturalmente válidos;
- auditoria funcional das páginas: 27/27;
- validação integral da release aprovada;
- cálculo real de domínio compilado com Kotlin e executado;
- Room 12→13 validado com 20.000 transações;
- sincronização, restauração e proteção do Supabase aprovadas;
- Proxy: build Vercel aprovado;
- Proxy: 505 arquivos JavaScript aprovados na verificação sintática;
- testes direcionados de histórico e pareamento aprovados;
- ZIPs extraídos e novamente validados.

## Limitações reais

A compilação Android completa não iniciou porque o Gradle Wrapper precisava obter o Gradle 8.10.2 em `services.gradle.org`, indisponível no ambiente. Não havia emulador ou aparelho conectado para validar gestos, renderização e tooltips fisicamente. O código de domínio foi compilado separadamente e os projetos foram validados por contratos, sintaxe, estrutura e testes disponíveis.

O período máximo real continua sujeito à disponibilidade histórica de cada ativo e benchmark. O sistema não fabrica pontos quando a fonte não possui cobertura.

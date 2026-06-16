# Equilíbrio: contrato completo do Proxy

## Objetivo
Garantir que o VALORAE Proxy entregue todas as informações exigidas pelo modal Equilíbrio do APK.

## Novo contrato
Endpoint principal:

```text
POST /api/v1/portfolio/equilibrium
```

O mesmo bloco também passa a sair dentro de `/api/v1/portfolio/allocation` e `/api/v1/portfolio/analyze` nos campos:

```text
equilibrium
balance
```

## Gráficos cobertos

### Consolidado
- Posição atual por ativos.
- Posição atual por tipo de ativos.
- Exposição Nacional / Exterior.

### Ações
- Posição atual ações.
- Posição atual das ações por segmento.
- Posição atual das ações por setor.

### FIIs
- Posição atual FIIs.
- Posição atual dos FIIs por tipo.
- Posição atual dos FIIs por segmento.

## Regras
- Aba Consolidado sempre habilitada.
- Aba Ações só aparece quando há ações na carteira.
- Aba FIIs só aparece quando há FIIs na carteira.
- O Proxy aceita metadados enviados pelo APK e usa catálogo VALORAE como fallback.
- O endpoint `/api/v1/assets` também passa a devolver metadados úteis para equilíbrio: `assetClass`, `sector`, `segment`, `exposure`, `stockSegment`, `stockSector`, `fiiType` e `fiiSegment`.

## Testes
Adicionado `test/portfolio-equilibrium-contract.test.js` para validar abas, gráficos e classificações de Ações/FIIs.

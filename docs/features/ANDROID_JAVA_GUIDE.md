# Android Java Guide — VALORAE Proxy

O cliente Android pode integrar usando HTTP simples. A rota mais importante para fundamentos e gráficos é:

```text
POST /api/scraper
```

Exemplo de corpo:

```json
{
  "mode": "fundamentos",
  "ticker": "BBAS3"
}
```

A resposta vem no envelope:

```json
{
  "json": {
    "ticker": "BBAS3",
    "graficos_i10": [],
    "chart_manifest": []
  }
}
```

## Recomendações no APK

- Renderize gráficos usando `chart_manifest` para descobrir os blocos disponíveis.
- Use `graficos_i10` quando precisar dos pontos completos.
- Se `renderable` for `false`, mostre estado vazio em vez de travar a tela.
- Não dependa apenas do sufixo do ticker para classificar ativo; use `tipo_ativo` e `classe_ativo` enviados pelo Proxy.
- Preserve timeout e tratamento de erro HTTP no app.

## Rotas auxiliares

- `GET /api/v1/health`
- `GET /api/v1/manifest`
- `GET /api/v1/asset/history`
- `GET /api/v1/asset/dividends`
- `POST /api/v1/mobile/portfolio-sync`
- `POST /api/v1/dividends/batch`

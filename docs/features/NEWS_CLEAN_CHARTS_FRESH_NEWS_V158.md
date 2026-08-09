# Proxy v158 — Notícias do dia

- Google News RSS passa a receber `when:1d` nas consultas gerais, por ticker e busca textual.
- O Proxy filtra itens sem data válida, futuros ou fora da janela recente de 36h.
- TTL reduzido para 120s e stale para 45min na rota modular de notícias.
- Metadados de freshness informam `queryWindow: when:1d` e `maxAgeHours: 36`.

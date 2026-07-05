# Checkpoint v253 — Informações sobre a empresa no modal de ações

- Contrato de ação atualizado para `26.asset-modal.stock.v34`.
- Adicionado payload `companyInformation`, extraído da seção `INFORMAÇÕES SOBRE A EMPRESA` do Investidor10.
- Normaliza valores simples e detalhados de valor de mercado, valor de firma, patrimônio, ativos, dívidas, disponibilidade, liquidez e número total de papéis.
- Normaliza campos de governança e classificação: Segmento de Listagem, Free Float, Tag Along, Setor e Segmento.
- Mantém política sem fallback fixo por ticker e sem mock em produção.

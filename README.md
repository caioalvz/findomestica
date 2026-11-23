# FinHub

Hub de finanças domésticas: receitas, despesas, vencimentos, orçamentos por categoria, metas de economia e relatórios de fechamento.

## Como rodar

Requer Node.js 22.5 ou superior (usa `node:sqlite`).

```bash
npm start        # http://localhost:3000  (PORT=3001 npm start para trocar a porta)
npm test         # testes da API
```

O banco SQLite fica em `data/finhub.db` e é criado com dados de exemplo na primeira execução.

## Telas

| Tela | O que faz |
| --- | --- |
| Visão Geral | Saldo, receitas, despesas e economia do mês; fluxo de 6 meses; vencimentos próximos (com "Pagar"); tetos e metas |
| Despesas / Receitas | Lançamentos com situação (pago/pendente), filtros, paginação, edição e exclusão |
| Extrato | Todos os lançamentos do mês; a busca do topo leva para cá |
| Categorias | Tetos mensais, consumo, alertas e categorias de receita |
| Metas | Metas de economia com aportes, resgates e sugestão de poupança mensal |
| Relatórios | Evolução de 6/12 meses, distribuição de gastos, fechamento mensal, diagnóstico, exportação CSV e PDF (impressão) |
| Configurações | Perfil, PIN de bloqueio, importação de extrato CSV, exportação CSV e backup/restauração JSON |

## Importar extrato

CSV com `data;descrição;valor`. Datas em `DD/MM/AAAA` ou `AAAA-MM-DD`. Valores negativos viram despesas, positivos viram receitas.

## Estrutura

- `server/` API HTTP sem dependências externas (`app.js`), SQLite (`db.js`, `schema.sql`) e PIN (`auth.js`)
- `public/` front-end em JS puro (módulos ES), uma view por tela em `js/views/`
- `test/` testes com `node:test`

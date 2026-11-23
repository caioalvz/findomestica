# FinHub

Hub de finanças domésticas: receitas, despesas, vencimentos, orçamentos por categoria, metas de economia e relatórios de fechamento.

É um site **100% estático** (HTML, CSS e JS puro, sem build e sem dependências). Os dados ficam no `localStorage` do navegador de quem usa, então cada pessoa tem as próprias finanças e nada é enviado a servidor algum.

## Como rodar

```bash
npm start        # servidor estático local em http://localhost:3000 (PORT=3001 para trocar)
npm test         # testes da camada de dados (Node 20+)
```

Também funciona abrindo a pasta `docs/` em qualquer hospedagem estática.

## Publicação (GitHub Pages)

O site é servido direto da pasta `docs/` da branch `main`. Rode `npm test` antes de fazer merge.
Configuração única: Settings → Pages → Source: **Deploy from a branch** → `main` / `/docs`.

## Telas

| Tela | O que faz |
| --- | --- |
| Visão Geral | Saldo, receitas, despesas e economia do mês; fluxo de 6 meses; vencimentos próximos (com "Pagar"); tetos e metas |
| Despesas / Receitas | Lançamentos com situação (pago/pendente), filtros, paginação, edição e exclusão |
| Extrato | Todos os lançamentos do mês; a busca do topo leva para cá |
| Categorias | Tetos mensais, consumo, alertas e categorias de receita |
| Metas | Metas de economia com aportes, resgates e sugestão de poupança mensal |
| Relatórios | Evolução de 6/12 meses, distribuição de gastos, fechamento mensal, diagnóstico, exportação CSV e PDF (impressão) |
| Configurações | Perfil, PIN de bloqueio de tela, importação de extrato CSV, exportação CSV, backup/restauração JSON e "começar do zero" |

## Sobre os dados

- Na primeira visita o app carrega dados de exemplo; use **Configurações → Começar do zero** para apagá-los.
- Limpar os dados do navegador apaga as finanças: baixe backups JSON com frequência para guardar ou levar os dados a outro aparelho.
- O PIN é só um bloqueio de tela. Ele não criptografa o que está salvo no navegador.

## Importar extrato

CSV com `data;descrição;valor`. Datas em `DD/MM/AAAA` ou `AAAA-MM-DD`. Valores negativos viram despesas, positivos viram receitas.

## Estrutura

- `docs/` o site: `index.html`, `css/` e `js/` (módulos ES; uma view por tela em `js/views/`)
- `public/js/store.js` toda a lógica de dados (sem DOM, testável no Node)
- `public/js/api.js` liga as telas ao store, aplica o bloqueio de tela e faz os downloads
- `server/index.js` servidor estático só para desenvolvimento
- `test/` testes com `node:test`

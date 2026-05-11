## Objetivo

Garantir que, sempre que algo for criado/editado/excluído em qualquer aba, **todas as outras abas que dependem desses dados se atualizem automaticamente** — sem precisar recarregar a página ou clicar em "Atualizar".

## Escopo

Auditoria + correção em todas as abas principais do dashboard:
Painel · Agenda · Agendamento Online · Cadastros · Orçamentos · Financeiro · Manutenções · BTU · PDV · Impostos · Lembretes · Backup · Empresa · Prestadores · Histórico · Funcionários

## Diagnóstico do problema atual

Hoje algumas mutações invalidam só o cache local da própria aba. Ex.:
- Confirmar agendamento online → cria `appointments`, mas Agenda só atualiza se o usuário clicar em Atualizar.
- Venda no PDV → entra em `financial_records` e baixa estoque, mas Estoque/Dashboard não recarregam.
- Concluir manutenção → não dispara refresh em Lembretes/Dashboard.
- Editar cliente em Cadastros → Agenda/PDV continuam mostrando nome antigo até refazer query.

## Solução (3 camadas)

### 1. Hook global `useRealtimeSync` (uma vez no `Index.tsx`)

Assina canais Supabase Realtime das tabelas-chave e, em **qualquer INSERT/UPDATE/DELETE**, invalida as queries relacionadas:

```text
appointments         → ['appointments', 'dashboard', 'historico']
online_bookings      → ['online-bookings']
clients              → ['clients-list', 'appointments', 'pdv', 'quotes']
products             → ['products-list', 'pdv', 'estoque']
sales                → ['financial-records', 'estoque', 'dashboard']
financial_records    → ['financial-records', 'dashboard', 'historico']
fixed_expenses       → ['fixed-expenses', 'financial-records', 'dashboard']
installments         → ['installments', 'appointments', 'dashboard']
maintenance_contracts→ ['contracts', 'financial-records', 'dashboard']
scheduled_maintenance→ ['maintenance', 'lembretes', 'dashboard']
quotes               → ['quotes', 'historico']
service_orders       → ['service-orders', 'historico']
company_data         → ['company']
team_members         → ['team', 'employees']
client_equipment     → ['equipment', 'maintenance']
```

Vantagem: funciona **mesmo em multi-aba/multi-dispositivo** (se o prestador aceitar no celular, o desktop atualiza).

### 2. Padronizar `queryKey` por tabela

Hoje cada componente usa keys diferentes (`['appointments']` vs `['agenda']`). Vou criar `src/lib/queryKeys.ts` com as chaves canônicas e refatorar os principais consumidores.

### 3. Invalidações locais ainda mais previsíveis

Em cada mutação direta (ex.: `updateStatus` em Online Bookings), invalidar **todas** as queryKeys ligadas, não só uma. Pequenas correções pontuais nos arquivos onde isso falha.

## Teste E2E (executado depois das mudanças)

Roteiro manual + queries SQL para validar:

| # | Ação | Resultado esperado em outras abas |
|---|------|-----------------------------------|
| 1 | Cadastrar cliente em Cadastros | Aparece no select da Agenda, PDV, Orçamentos |
| 2 | Criar agendamento na Agenda | Conta sobe no Dashboard e Histórico |
| 3 | Receber pedido em Agendamento Online | Badge "pendente" aparece em tempo real |
| 4 | Aceitar pedido online | Entra em Agenda automaticamente + sai do pendente |
| 5 | Concluir agendamento | Entra como entrada em Financeiro + sobe no Dashboard |
| 6 | Vender no PDV | Estoque cai + Financeiro registra + Dashboard atualiza |
| 7 | Adicionar gasto fixo | Saldo do Financeiro recalcula + Dashboard mostra |
| 8 | Criar contrato de manutenção | Lembrete agendado aparece em Manutenções e Lembretes |
| 9 | Editar dados em Empresa | Logo/dados atualizam no link público de agendamento |
| 10 | Convidar prestador | Aparece no select de prestadores da Agenda |

## Arquivos afetados

- **Novo:** `src/lib/queryKeys.ts` — chaves canônicas
- **Novo:** `src/hooks/useRealtimeSync.ts` — assina realtime e invalida queries
- **Editado:** `src/pages/Index.tsx` — instalar o hook global
- **Editados (pontuais):** `OnlineBookingsTab.tsx`, `AppointmentsTab.tsx`, `PDVTab.tsx`, `FinanceiroTab.tsx`, `CadastrosUnifiedTab.tsx`, `ServicesUnifiedTab.tsx`, `LembretesTab.tsx`, `CompanyDataTab.tsx` — usar as chaves canônicas e invalidar grupos completos nas mutações.

## Fora do escopo

- Mudanças de UI/design (só sincronização e refresh).
- Migrações de banco (tabelas e RLS já estão corretas; realtime já está habilitado nas tabelas principais; se faltar alguma, habilito via `ALTER PUBLICATION supabase_realtime ADD TABLE …`).
- Reescrever componentes — só ajustes cirúrgicos.

## Entregável

Ao final, qualquer alteração feita em uma aba reflete automaticamente nas demais sem necessidade de F5, sem necessidade de clicar em "Atualizar", e o relatório do teste E2E confirma cada caso da tabela acima.

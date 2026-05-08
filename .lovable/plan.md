# Plano: Conciliação financeira robusta + Agenda Online com horários da empresa

Bloco grande dividido em 4 frentes. Foco em **eliminar duplicatas**, **rastrear divergências** e **profissionalizar o agendamento online** (igual ao mock anexado).

---

## 1. Anti-duplicidade no `financial_records`

### Banco (migration)
- **Constraint única parcial** garantindo idempotência por agendamento:
  `UNIQUE (user_id, appointment_id, type)` quando `appointment_id IS NOT NULL`.
- **Constraint única parcial** para vendas PDV:
  `UNIQUE (user_id, sale_id, type)` (adiciona coluna `sale_id uuid` em `financial_records` apontando para `sales.id`).
- **Trigger `prevent_financial_duplicate`** (BEFORE INSERT): se já existir linha equivalente nas últimas 24h (mesmo `user_id`, mesmo `amount`, mesma `description` normalizada, mesmo `type`, mesma `record_date::date`), bloqueia com `RAISE EXCEPTION` claro ("Lançamento duplicado detectado").
- **View `financial_audit_view`**: JOIN entre `financial_records ↔ sales ↔ appointments ↔ fixed_expenses` por usuário/mês para a tela de conciliação.

### Helper `recordFinancialEntry`
- Aceita novo parâmetro `saleId`.
- Antes de inserir, faz busca dupla: por `appointment_id` **ou** por `sale_id`.
- Tratar erro `23505` (unique_violation) sem propagar como erro fatal — retornar `{ data: null, error: null, skipped: true }`.

### PDV (`PDVTab.tsx`)
- Passa `saleId` ao chamar `recordFinancialEntry` (criamos a venda primeiro, pegamos o `id`, depois inserimos o financial_record).
- Categoria normalizada: sempre `Produto` (não `Venda`, não `PDV`).
- Se a venda for serviço avulso (sem produto físico), usa categoria `Serviço`.

---

## 2. Tela de Conciliação Financeira

Nova aba dentro de **Financeiro → Relatórios** chamada **"Conciliação"** (não cria tab nova proibida).

Mostra para o mês selecionado, agrupado por categoria:
- **Vendas no PDV sem `financial_record`** (sales órfãs) → botão "Sincronizar"
- **`financial_record` órfãos** (com `appointment_id`/`sale_id` apontando para registro deletado) → botão "Remover"
- **Duplicatas detectadas** (mesmo valor + descrição em <24h) → botão "Manter primeiro / remover demais"
- **Divergência de totais**: tabela com `Categoria | Soma sales | Soma financial_records | Diferença`
- **Por prestador**: receita rota vs gastos lançados

Tudo em uma única tela com cards de status (verde = OK, amarelo = atenção, vermelho = ação necessária).

---

## 3. Agenda Online profissional (estilo anexo)

### Configuração da empresa (nova ou atualiza `admin_settings`)
Chave `online_booking_config` (JSON):
```json
{
  "enabled": true,
  "weekdays": { "mon": true, "tue": true, ..., "sun": false },
  "start_time": "08:00",
  "end_time": "18:00",
  "slot_minutes": 30,
  "lunch_break": { "start": "12:00", "end": "13:00" },
  "min_advance_hours": 2,
  "max_advance_days": 30,
  "auto_confirm": false
}
```

Tela de configuração em **Cadastros → Agendamento Online** (form simples com switches e time pickers).

### Página pública (`PublicBooking.tsx`)
- Lê config da empresa em tempo real.
- Gera grid de horários **igual ao anexo** (botões pílula azul/ciano destacando o selecionado).
- **Bloqueia** horários:
  - Fora da janela `start_time`–`end_time`
  - Em dias desativados
  - Antes de `now() + min_advance_hours` (impede madrugada)
  - Já reservados (consulta `appointments` da data)
- Cabeçalho: "Horários disponíveis para DD/MM"
- Mobile-first, alvos ≥44px.

### Fluxo automático para rotas
- Toda reserva online entra como `status = 'pendente'` em `appointments`.
- Quando o admin clica **Confirmar** → status vira `confirmado` E é automaticamente adicionado à fila de **Roteiro do Prestador** (se houver prestador padrão configurado, ou aguarda atribuição na tela Calendário).
- Notificação toast no Dashboard: "Nova reserva online: cliente X às HH:MM".
- Realtime: subscribe em `appointments` filtrando `source = 'online_booking'`.

---

## 4. Rastreador de erros financeiros

Tabela nova `financial_audit_log`:
- `event_type`: `duplicate_blocked | orphan_detected | sync_pdv | reconcile_run | manual_delete`
- `user_id`, `record_id`, `details JSONB`, `created_at`
- Trigger automaticamente loga toda inserção bloqueada e toda execução de reconciliação.
- Exibido na tela de Conciliação como timeline ("Últimas 50 ações").

---

## Detalhes técnicos

```text
financial_records
  + sale_id uuid REFERENCES sales(id) ON DELETE SET NULL
  + UNIQUE INDEX (user_id, appointment_id, type) WHERE appointment_id IS NOT NULL
  + UNIQUE INDEX (user_id, sale_id, type) WHERE sale_id IS NOT NULL
  + TRIGGER prevent_financial_duplicate BEFORE INSERT

financial_audit_log (nova)
  - id, user_id, event_type, record_id, details jsonb, created_at
  - RLS: user vê só os próprios

admin_settings
  - chave 'online_booking_config' (JSON por usuário/empresa)

VIEW financial_audit_view
  - SELECT por mês: receita esperada, receita registrada, despesas, lucro real
```

Arquivos novos/editados:
- `supabase/migrations/*.sql` (constraints, trigger, audit log, view)
- `src/utils/financialHelpers.ts` (sale_id + tratamento 23505)
- `src/components/PDVTab.tsx` (passar sale_id)
- `src/components/FinanceiroReconciliationTab.tsx` (nova)
- `src/components/FinanceiroReportsTab.tsx` (incluir aba Conciliação)
- `src/components/OnlineBookingConfigTab.tsx` (nova - config dentro de Cadastros)
- `src/pages/PublicBooking.tsx` (grid de horários estilo mock + validação)
- `src/components/CadastrosUnifiedTab.tsx` (incluir card Agendamento Online)

---

## Ordem de execução

1. Migration (constraints + audit log + view)
2. Helper `recordFinancialEntry` com sale_id e tratamento 23505
3. PDV passa sale_id
4. Tela de Conciliação
5. Config de Agendamento Online (admin)
6. PublicBooking redesenhado igual ao mock
7. Fluxo Confirmar → fila de roteiro

Posso já criar a migration assim que aprovar.

## Objetivo
Centralizar o horário de funcionamento da empresa em **uma única fonte** (`online_booking_settings`) e fazer **TODAS** as agendas (manual e online) puxarem dela em tempo real, com suporte a **férias/feriados** que bloqueiam ambos os fluxos. Garantir que serviços usem **duração exata** cadastrada (sem arredondamento).

## Mudanças

### 1. Banco de dados
- Adicionar coluna `vacations jsonb` em `online_booking_settings` (lista de períodos `{start_date, end_date, reason}`).
- Garantir registro padrão criado para todo usuário ao acessar a aba.

### 2. Aba "Minha Empresa" → seção Horário (CompanyDataTab.tsx)
Substituir os 3 inputs simples por um painel completo:
- **Toggle por dia da semana** (Seg–Dom) com horário individual de abertura/fechamento (sincroniza com `weekdays`/`start_time`/`end_time`).
- **Almoço** (start/end opcional).
- **Slot mínimo** (15/30/60 min).
- **Antecedência mínima** (horas) e **máxima** (dias).
- **Férias/Folgas** — lista editável: adicionar período (data início, data fim, motivo), remover, todos bloqueiam agendas.
- Botões **Salvar** e indicação de "fonte única para agenda manual e online".
- Mensagem informativa: "Esta configuração é usada por todo o sistema (agenda, agenda online, rotas)."

### 3. Agenda manual (componente que cria appointments)
- Hook novo `useBusinessHours()` que retorna settings + funções `isDateAllowed(date)`, `isTimeAllowed(date, time)`, `isOnVacation(date)`, `getServiceEndTime(start, durationMin)`.
- Ao criar/editar agendamento manual: validar dia da semana, horário, almoço, férias, antecedência mínima — bloquear com mensagem clara.
- Duração do serviço usa `products.service_duration` exato (sem arredondar para slot).

### 4. Agenda online (`PublicBooking` + edge function `public-booking`)
- Já lê `online_booking_settings`; estender para respeitar `vacations` (server-side e client-side).
- Bloquear datas dentro de qualquer período de férias (UI mostra "Em férias até DD/MM").
- Manter validação real-time já existente (`server_time`, `min_advance_hours`).

### 5. Edge function `public-booking`
- Retornar `vacations` no GET.
- POST: rejeitar se data cair em período de férias.

## Arquivos
- `supabase/migrations/...` — adicionar coluna `vacations`.
- `src/hooks/useBusinessHours.ts` — novo.
- `src/components/CompanyDataTab.tsx` — refazer card "Horário".
- `src/pages/PublicBooking.tsx` — respeitar férias.
- `supabase/functions/public-booking/index.ts` — retornar/validar férias.
- Componentes de agenda manual existentes — adicionar validação via hook (apenas onde criam appointments).

## Observação
Manterei "Dias de Trabalho" texto-livre apenas para PDF/landing; a fonte real para o sistema é a configuração estruturada nova.
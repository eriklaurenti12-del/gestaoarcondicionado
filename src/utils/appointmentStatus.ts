// Canonical appointment statuses (4 only)
export type AppointmentStatus = 'pendente' | 'confirmado' | 'concluido' | 'cancelado';

const LEGACY_MAP: Record<string, AppointmentStatus> = {
  agendado: 'pendente',
  agendada: 'pendente',
  futura: 'pendente',
  enviado_prestador: 'confirmado',
  'concluído': 'concluido',
  concluida: 'concluido',
  'concluída': 'concluido',
  cancelada: 'cancelado',
};

export const normalizeStatus = (status?: string | null): AppointmentStatus => {
  if (!status) return 'pendente';
  const s = String(status).toLowerCase().trim();
  if (s in LEGACY_MAP) return LEGACY_MAP[s];
  if (['pendente', 'confirmado', 'concluido', 'cancelado'].includes(s)) return s as AppointmentStatus;
  return 'pendente';
};

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const STATUS_COLOR: Record<AppointmentStatus, string> = {
  pendente: 'bg-amber-500/10 text-amber-600 border-amber-200',
  confirmado: 'bg-blue-500/10 text-blue-600 border-blue-200',
  concluido: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  cancelado: 'bg-red-500/10 text-red-600 border-red-200',
};

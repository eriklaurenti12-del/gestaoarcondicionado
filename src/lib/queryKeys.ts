// Maps a Postgres table name → list of substring tokens. Any query whose
// first queryKey segment contains one of these tokens is invalidated when
// the table changes. Substring matching covers the many key variants used
// across components (e.g. 'appointments', 'calendar-appointments',
// 'appointments-board', 'route-appointments', etc.)

export const TABLE_TO_TOKENS: Record<string, string[]> = {
  appointments: [
    'appointment', 'agenda', 'calendar', 'dashboard', 'historico', 'hist-',
    'route-', 'rotating-', 'report-', 'portal-today', 'charts-',
    'monthly-revenue', 'pending-appointments', 'completed-appointments',
    'expenses-for-providers',
  ],
  online_bookings: ['online-booking', 'portal-bookings', 'dashboard'],
  clients: [
    'client', 'all-clients', 'portal-clients', 'clients-for-schedule',
    'clients-lembretes', 'clients-support', 'dashboard', 'reports',
  ],
  products: [
    'product', 'portal-products', 'estoque', 'supplier-products',
    'hist-products', 'dashboard',
  ],
  sales: [
    'sales', 'sales-financial', 'sales-history', 'recon-sales',
    'report-sales', 'hist-sales', 'portal-sales', 'monthly-revenue',
    'rotating-', 'dashboard', 'historico',
  ],
  financial_records: [
    'financial', 'financial-records', 'financial_records', 'recon-records',
    'monthly-revenue', 'completed-appointments-financial',
    'pending-appointments-financial', 'dashboard', 'historico',
    'portal-financial', 'charts-',
  ],
  fixed_expenses: [
    'fixed-expenses', 'fixed_expenses', 'hist-fixed-expenses',
    'report-expenses', 'monthly-revenue', 'dashboard',
  ],
  installments: [
    'installments', 'rotating-installments', 'appointments', 'dashboard',
  ],
  maintenance_contracts: [
    'maintenance-contracts', 'contracts', 'rotating-contracts',
    'company-data-contracts', 'monthly-revenue', 'dashboard', 'historico',
  ],
  scheduled_maintenance: [
    'maintenance', 'all-maintenances', 'rotating-maintenances',
    'equipment-maintenances', 'dashboard',
  ],
  quotes: [
    'quotes', 'monthly-quotes', 'pending-quotes', 'hist-quotes', 'historico',
  ],
  service_orders: [
    'service-orders', 'pending-orders', 'historico', 'financial-records',
  ],
  company_data: [
    'company-data', 'company-data-contracts', 'company-data-sidebar',
    'business-hours',
  ],
  team_members: [
    'team', 'service-providers', 'service-providers-unified',
    'appointments-for-providers', 'calendar-providers', 'employees',
  ],
  client_equipment: [
    'client-equipment', 'equipment-maintenances', 'maintenance',
  ],
  suppliers: ['supplier', 'portal-suppliers'],
  tax_records: ['tax-record', 'taxes', 'monthly-revenue', 'dashboard'],
};

/** Returns true if a queryKey contains any of the tokens. */
export function keyMatchesTokens(queryKey: unknown, tokens: string[]): boolean {
  if (!Array.isArray(queryKey)) return false;
  for (const seg of queryKey) {
    if (typeof seg !== 'string') continue;
    for (const tok of tokens) {
      if (seg.includes(tok)) return true;
    }
  }
  return false;
}

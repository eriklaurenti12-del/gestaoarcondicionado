// Canonical query keys used across the app.
// Always reference these from useQuery/invalidateQueries so cross-tab refreshes
// can target the right caches.

export const queryKeys = {
  appointments: ['appointments'] as const,
  onlineBookings: ['online-bookings'] as const,
  clients: ['clients-list'] as const,
  products: ['products-list'] as const,
  sales: ['sales'] as const,
  financialRecords: ['financial-records'] as const,
  fixedExpenses: ['fixed-expenses'] as const,
  installments: ['installments'] as const,
  contracts: ['contracts'] as const,
  maintenance: ['scheduled-maintenance'] as const,
  quotes: ['quotes'] as const,
  serviceOrders: ['service-orders'] as const,
  company: ['company-data'] as const,
  team: ['team-members'] as const,
  employees: ['employees'] as const,
  equipment: ['client-equipment'] as const,
  suppliers: ['suppliers'] as const,
  taxes: ['tax-records'] as const,
  dashboard: ['dashboard'] as const,
  historico: ['historico'] as const,
};

// Map a Postgres table to the list of cache keys that should be invalidated
// whenever a row in that table is inserted/updated/deleted (anywhere in the world).
export const TABLE_TO_KEYS: Record<string, readonly (readonly string[])[]> = {
  appointments: [queryKeys.appointments, queryKeys.dashboard, queryKeys.historico, queryKeys.installments],
  online_bookings: [queryKeys.onlineBookings, queryKeys.appointments, queryKeys.dashboard],
  clients: [queryKeys.clients, queryKeys.appointments, queryKeys.quotes, queryKeys.historico],
  products: [queryKeys.products, queryKeys.dashboard],
  sales: [queryKeys.sales, queryKeys.financialRecords, queryKeys.products, queryKeys.dashboard, queryKeys.historico],
  financial_records: [queryKeys.financialRecords, queryKeys.dashboard, queryKeys.historico],
  fixed_expenses: [queryKeys.fixedExpenses, queryKeys.financialRecords, queryKeys.dashboard],
  installments: [queryKeys.installments, queryKeys.appointments, queryKeys.dashboard, queryKeys.financialRecords],
  maintenance_contracts: [queryKeys.contracts, queryKeys.financialRecords, queryKeys.dashboard, queryKeys.historico],
  scheduled_maintenance: [queryKeys.maintenance, queryKeys.dashboard],
  quotes: [queryKeys.quotes, queryKeys.historico],
  service_orders: [queryKeys.serviceOrders, queryKeys.historico, queryKeys.financialRecords],
  company_data: [queryKeys.company],
  team_members: [queryKeys.team, queryKeys.employees],
  client_equipment: [queryKeys.equipment, queryKeys.maintenance],
  suppliers: [queryKeys.suppliers, queryKeys.products],
  tax_records: [queryKeys.taxes, queryKeys.financialRecords, queryKeys.dashboard],
};

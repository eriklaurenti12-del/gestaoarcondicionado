// Lixeira local (localStorage) para exclusões financeiras.
// Permite "Desfazer" recente e visualização das últimas exclusões para restauração.

import { supabase } from "@/integrations/supabase/client";

export type TrashItemType = "financial_record" | "sale";

export interface TrashItem {
  id: string;                 // id local da entrada na lixeira
  type: TrashItemType;
  reason?: string | null;
  deletedAt: string;          // ISO
  userId: string;
  // Snapshot completo da linha (e linhas vinculadas para venda)
  payload: {
    record?: any;             // financial_records row
    sale?: any;               // sales row
    linkedRecords?: any[];    // financial_records vinculados a essa venda
  };
  // Resumo legível para UI da lixeira
  summary: {
    title: string;
    amount?: number;
    dateLabel?: string;
  };
}

const KEY = "financeiro_trash_v1";
const MAX_AGE_DAYS = 30;
const MAX_ITEMS = 200;

function readAll(): TrashItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: TrashItem[] = JSON.parse(raw);
    // expira itens antigos
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    return arr.filter((it) => new Date(it.deletedAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

function writeAll(items: TrashItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {}
}

export function listTrash(userId: string): TrashItem[] {
  return readAll()
    .filter((it) => it.userId === userId)
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

export function pushTrash(item: Omit<TrashItem, "id" | "deletedAt">): TrashItem {
  const full: TrashItem = {
    ...item,
    id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    deletedAt: new Date().toISOString(),
  };
  writeAll([full, ...readAll()]);
  return full;
}

export function removeTrash(id: string) {
  writeAll(readAll().filter((it) => it.id !== id));
}

export function clearOldTrash() {
  writeAll(readAll());
}

/** Apaga TODOS os itens da lixeira de um usuário (ação irreversível). */
export function clearAllTrash(userId: string) {
  writeAll(readAll().filter((it) => it.userId !== userId));
}

/**
 * Roda automaticamente uma vez por mês: ao detectar que o mês mudou desde
 * a última passagem, apaga permanentemente todos os itens da lixeira do
 * usuário cuja exclusão ocorreu em meses anteriores.
 * Usa localStorage para persistir a marca do último ciclo.
 */
const LAST_PURGE_KEY = "financeiro_trash_last_purge";

export function autoPurgeOnMonthChange(userId: string): { ran: boolean; removed: number } {
  if (!userId) return { ran: false, removed: 0 };
  try {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const map = JSON.parse(localStorage.getItem(LAST_PURGE_KEY) || "{}");
    if (map[userId] === stamp) return { ran: false, removed: 0 };

    const before = listTrash(userId).length;
    purgePreviousMonths(userId);
    const after = listTrash(userId).length;

    map[userId] = stamp;
    localStorage.setItem(LAST_PURGE_KEY, JSON.stringify(map));
    return { ran: true, removed: Math.max(0, before - after) };
  } catch {
    return { ran: false, removed: 0 };
  }
}

/** Apaga itens cuja data de exclusão é anterior ao mês corrente. */
export function purgePreviousMonths(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  writeAll(
    readAll().filter((it) => {
      if (it.userId !== userId) return true;
      return new Date(it.deletedAt).getTime() >= startOfMonth;
    })
  );
}

// Restaura no banco usando o snapshot. Mantém o id original quando possível.
export async function restoreTrashItem(item: TrashItem): Promise<void> {
  const { record, sale, linkedRecords } = item.payload;
  if (item.type === "financial_record" && record) {
    const { id, ...rest } = record;
    // tenta com id original (preserva referências); se conflitar, insere sem id.
    const tryWithId = await supabase.from("financial_records").insert({ id, ...rest });
    if (tryWithId.error) {
      const { error } = await supabase.from("financial_records").insert(rest);
      if (error && (error as any).code !== "23505") throw error;
    }
  } else if (item.type === "sale" && sale) {
    const { id, ...rest } = sale;
    const trySale = await supabase.from("sales").insert({ id, ...rest } as any);
    if (trySale.error) {
      const { error } = await supabase.from("sales").insert(rest as any);
      if (error && (error as any).code !== "23505") throw error;
    }
    if (linkedRecords && linkedRecords.length) {
      for (const r of linkedRecords) {
        const { id: rid, ...rrest } = r;
        const tryR = await supabase.from("financial_records").insert({ id: rid, ...rrest });
        if (tryR.error) {
          await supabase.from("financial_records").insert(rrest);
        }
      }
    }
  }
  removeTrash(item.id);
}

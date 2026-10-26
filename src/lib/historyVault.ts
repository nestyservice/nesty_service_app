import { OrderRecord, PaymentRecord } from '../types';

const ORDER_VAULT_PREFIX = 'nesty_order_vault_';
const PAYMENT_VAULT_PREFIX = 'nesty_payment_vault_';

export function getOrdersFromVault(studentEmail: string): OrderRecord[] {
  if (!studentEmail) return [];
  try {
    const key = ORDER_VAULT_PREFIX + studentEmail.toLowerCase().trim();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistOrdersToVault(studentEmail: string, orders: OrderRecord[]): OrderRecord[] {
  if (!studentEmail || !Array.isArray(orders)) return [];
  try {
    const key = ORDER_VAULT_PREFIX + studentEmail.toLowerCase().trim();
    const existing = getOrdersFromVault(studentEmail);
    const map = new Map<string, OrderRecord>();

    // Put existing vault orders first
    for (const o of existing) {
      if (o && o.id) map.set(o.id, o);
    }
    // Merge newer / updated server orders
    for (const o of orders) {
      if (o && o.id) {
        const prev = map.get(o.id);
        map.set(o.id, {
          ...prev,
          ...o,
          billStatus: o.billStatus || prev?.billStatus || (o.orderStatus === 'CLAIMED' ? 'EXPIRED' : 'ACTIVE'),
        });
      }
    }

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
  } catch {
    return orders;
  }
}

export function getPaymentsFromVault(studentEmail: string): PaymentRecord[] {
  if (!studentEmail) return [];
  try {
    const key = PAYMENT_VAULT_PREFIX + studentEmail.toLowerCase().trim();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistPaymentsToVault(studentEmail: string, payments: PaymentRecord[]): PaymentRecord[] {
  if (!studentEmail || !Array.isArray(payments)) return [];
  try {
    const key = PAYMENT_VAULT_PREFIX + studentEmail.toLowerCase().trim();
    const existing = getPaymentsFromVault(studentEmail);
    const map = new Map<string, PaymentRecord>();

    for (const p of existing) {
      const pKey = p.id || p.transactionId;
      if (pKey) map.set(pKey, p);
    }
    for (const p of payments) {
      const pKey = p.id || p.transactionId;
      if (pKey) {
        const prev = map.get(pKey);
        map.set(pKey, {
          ...prev,
          ...p,
          billStatus: p.billStatus || prev?.billStatus || 'ACTIVE',
        });
      }
    }

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
  } catch {
    return payments;
  }
}

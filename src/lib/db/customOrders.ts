import { adminFetch } from '../adminAuth';
import { isDemoAdmin } from '../demoMode';
import {
  archiveCustomOrder as archiveDemoCustomOrder,
  createCustomOrder as createDemoCustomOrder,
  listCustomOrders as listDemoCustomOrders,
  sendCustomOrderPaymentLink as sendDemoPaymentLink,
  updateCustomOrder as updateDemoCustomOrder,
} from '../adminClient';

export type AdminCustomOrder = {
  id: string;
  displayCustomOrderId: string;
  customerName: string;
  customerEmail: string;
  description: string;
  imageUrl?: string | null;
  imageId?: string | null;
  imageStorageKey?: string | null;
  amount: number | null;
  shippingCents?: number;
  showOnSoldProducts?: boolean;
  status: 'pending' | 'paid';
  paymentLink: string | null;
  createdAt: string | null;
  archived?: boolean;
  archivedAt?: string | null;
};

const ADMIN_CUSTOM_ORDERS_PATH = '/api/admin/custom-orders';

export async function getAdminCustomOrders(): Promise<AdminCustomOrder[]> {
  if (isDemoAdmin()) return listDemoCustomOrders();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const url = `${ADMIN_CUSTOM_ORDERS_PATH}?ts=${Date.now()}`;

  const res = await adminFetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(bodyText || `Failed to fetch admin custom orders (${res.status})`);
  }

  const data = bodyText ? JSON.parse(bodyText) : {};
  return Array.isArray(data.orders) ? (data.orders as AdminCustomOrder[]) : [];
}

export async function createAdminCustomOrder(payload: {
  customerName: string;
  customerEmail: string;
  description: string;
  imageUrl?: string | null;
  imageId?: string | null;
  imageStorageKey?: string | null;
  amount?: number;
  showOnSoldProducts?: boolean;
  messageId?: string | null;
  shippingCents?: number;
  paymentLink?: string | null;
}): Promise<AdminCustomOrder> {
  if (isDemoAdmin()) {
    return createDemoCustomOrder({
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      description: payload.description,
      imageUrl: payload.imageUrl,
      imageId: payload.imageId,
      imageStorageKey: payload.imageStorageKey,
      amount: payload.amount,
      showOnSoldProducts: payload.showOnSoldProducts,
      shippingCents: payload.shippingCents,
      status: 'pending',
      paymentLink: null,
    });
  }

  const res = await adminFetch(ADMIN_CUSTOM_ORDERS_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.error || data.detail)) || `Failed to create custom order (${res.status})`;
    throw new Error(message);
  }

  if (data?.order) return data.order as AdminCustomOrder;

  return {
    id: data.id as string,
    displayCustomOrderId: data.displayId as string,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    description: payload.description,
    imageUrl: payload.imageUrl ?? null,
    imageId: payload.imageId ?? null,
    imageStorageKey: payload.imageStorageKey ?? null,
    amount: payload.amount ?? null,
    showOnSoldProducts: payload.showOnSoldProducts ?? false,
    status: 'pending',
    paymentLink: payload.paymentLink ?? null,
    createdAt: data.createdAt as string,
  };
}

export async function updateAdminCustomOrder(
  id: string,
  patch: Partial<{
    customerName: string;
    customerEmail: string;
    description: string;
    imageUrl: string | null;
    imageId: string | null;
    imageStorageKey: string | null;
    amount: number | null;
    shippingCents: number | null;
    showOnSoldProducts: boolean;
    status: 'pending' | 'paid';
    paymentLink: string | null;
    messageId: string | null;
  }>
): Promise<void> {
  if (isDemoAdmin()) {
    await updateDemoCustomOrder(id, patch as Partial<AdminCustomOrder>);
    return;
  }

  const res = await adminFetch(`${ADMIN_CUSTOM_ORDERS_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = (data && (data.error || data.detail)) || `Failed to update custom order (${res.status})`;
    throw new Error(message);
  }
}

export async function archiveAdminCustomOrder(id: string): Promise<AdminCustomOrder> {
  if (isDemoAdmin()) return archiveDemoCustomOrder(id);

  const res = await adminFetch(`${ADMIN_CUSTOM_ORDERS_PATH}/${encodeURIComponent(id)}/archive`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.error || data.detail)) || `Failed to archive custom order (${res.status})`;
    throw new Error(message);
  }

  if (data?.order) return data.order as AdminCustomOrder;
  throw new Error('Failed to archive custom order');
}

export async function sendAdminCustomOrderPaymentLink(
  id: string
): Promise<{ paymentLink: string; sessionId: string; emailOk?: boolean }> {
  if (isDemoAdmin()) return sendDemoPaymentLink(id);

  const res = await adminFetch(`${ADMIN_CUSTOM_ORDERS_PATH}/${encodeURIComponent(id)}/send-payment-link`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.error || data.detail)) || `Failed to send payment link (${res.status})`;
    throw new Error(message);
  }

  return {
    paymentLink: data.paymentLink as string,
    sessionId: data.sessionId as string,
    emailOk: data.emailOk,
  };
}

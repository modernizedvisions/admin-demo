import { adminFetch } from './adminAuth';
import type { Promotion } from './types';
import { isDemoAdmin } from './demoMode';
import {
  createPromotion as createDemoPromotion,
  deletePromotion as deleteDemoPromotion,
  listPromotions as listDemoPromotions,
  updatePromotion as updateDemoPromotion,
} from './adminClient';

export type PromotionInput = {
  name: string;
  percentOff: number;
  scope: 'global' | 'categories';
  categorySlugs?: string[];
  bannerEnabled?: boolean;
  bannerText?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  enabled?: boolean;
};

const PROMOTIONS_PATH = '/api/admin/promotions';

export async function fetchAdminPromotions(): Promise<Promotion[]> {
  if (isDemoAdmin()) return listDemoPromotions();
  const response = await adminFetch(PROMOTIONS_PATH, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Failed to load promotions (${response.status})`);
  const data = await response.json();
  return Array.isArray(data.promotions) ? (data.promotions as Promotion[]) : [];
}

export async function createAdminPromotion(payload: PromotionInput): Promise<Promotion> {
  if (isDemoAdmin()) return createDemoPromotion(payload);
  const response = await adminFetch(PROMOTIONS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Failed to create promotion (${response.status})`);
  }
  return data.promotion as Promotion;
}

export async function updateAdminPromotion(id: string, updates: Partial<PromotionInput>): Promise<Promotion> {
  if (isDemoAdmin()) return updateDemoPromotion(id, updates);
  const response = await adminFetch(`${PROMOTIONS_PATH}?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Failed to update promotion (${response.status})`);
  }
  return data.promotion as Promotion;
}

export async function deleteAdminPromotion(id: string): Promise<void> {
  if (isDemoAdmin()) return deleteDemoPromotion(id);
  const response = await adminFetch(`${PROMOTIONS_PATH}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Failed to delete promotion (${response.status})`);
  }
}

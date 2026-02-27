import type { Product } from '../types';
import { adminFetch } from '../adminAuth';
import { isDemoAdmin } from '../demoMode';
import {
  createProduct as createDemoProduct,
  deleteProduct as deleteDemoProduct,
  listProducts as listDemoProducts,
  updateProduct as updateDemoProduct,
} from '../adminClient';

export type AdminProductInput = {
  name: string;
  description: string;
  priceCents: number;
  category: Product['type'];
  imageUrl: string;
  imageUrls?: string[];
  primaryImageId?: string;
  imageIds?: string[];
  quantityAvailable?: number;
  isOneOff?: boolean;
  isActive?: boolean;
  stripePriceId?: string;
  stripeProductId?: string;
  collection?: string;
  shippingOverrideEnabled?: boolean;
  shippingOverrideAmountCents?: number | null;
};

export type AdminProductUpdateInput = Partial<AdminProductInput>;

const ADMIN_PRODUCTS_PATH = '/api/admin/products';

const handleResponse = async (response: Response) => {
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || data?.detail || text || `Request failed with status ${response.status}`;
    const trimmed = typeof message === 'string' && message.length > 500 ? `${message.slice(0, 500)}...` : message;
    throw new Error(typeof trimmed === 'string' ? trimmed : `Request failed with status ${response.status}`);
  }

  return data ?? {};
};

export async function fetchAdminProducts(): Promise<Product[]> {
  if (isDemoAdmin()) return listDemoProducts();

  const response = await adminFetch(ADMIN_PRODUCTS_PATH, { headers: { Accept: 'application/json' } });
  const data = await handleResponse(response);
  return Array.isArray(data.products) ? (data.products as Product[]) : [];
}

export async function createAdminProduct(input: AdminProductInput): Promise<Product | null> {
  if (isDemoAdmin()) {
    return createDemoProduct({
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      type: input.category,
      category: input.category,
      imageUrl: input.imageUrl,
      imageUrls: input.imageUrls,
      primaryImageId: input.primaryImageId,
      imageIds: input.imageIds,
      quantityAvailable: input.quantityAvailable,
      oneoff: input.isOneOff,
      visible: input.isActive,
      collection: input.collection,
      shippingOverrideEnabled: input.shippingOverrideEnabled,
      shippingOverrideAmountCents: input.shippingOverrideAmountCents,
    });
  }

  const response = await adminFetch(ADMIN_PRODUCTS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await handleResponse(response);
  return data.product ?? null;
}

export async function updateAdminProduct(id: string, input: AdminProductUpdateInput): Promise<Product | null> {
  if (isDemoAdmin()) {
    const patch: Partial<Product> = {
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      type: input.category,
      category: input.category,
      imageUrl: input.imageUrl,
      imageUrls: input.imageUrls,
      primaryImageId: input.primaryImageId,
      imageIds: input.imageIds,
      quantityAvailable: input.quantityAvailable,
      oneoff: input.isOneOff,
      visible: input.isActive,
      collection: input.collection,
      shippingOverrideEnabled: input.shippingOverrideEnabled,
      shippingOverrideAmountCents: input.shippingOverrideAmountCents,
    };
    return updateDemoProduct(id, patch);
  }

  const response = await adminFetch(`${ADMIN_PRODUCTS_PATH}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await handleResponse(response);
  return data.product ?? null;
}

export async function deleteAdminProduct(id: string): Promise<void> {
  if (isDemoAdmin()) {
    await deleteDemoProduct(id);
    return;
  }

  const response = await adminFetch(`${ADMIN_PRODUCTS_PATH}/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  await handleResponse(response);
}

import type { AdminOrder } from './db/orders';
import type { AdminCustomOrder } from './db/customOrders';
import type { Category, HomeSiteContent, Product, PromoCode, Promotion } from './types';
import type { EmailListItem } from './emailListTypes';
import type {
  OrderShipment,
  ShipFromSettings,
  ShipmentQuote,
  ShipmentQuoteDebugHints,
  ShippingBoxPreset,
} from './adminShipping';
import { isDemoAdmin } from './demoMode';
import { actions, demoId, getState } from '../demo/demoStore';
import type { SeedCustomOrderExample } from '../demo/seed/content';

const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const nowIso = () => new Date().toISOString();

const toPriceLabel = (priceCents?: number | null) => `$${((priceCents || 0) / 100).toFixed(2)}`;

const ensureDemo = () => {
  if (!isDemoAdmin()) {
    throw new Error('adminClient demo function called when demo mode is disabled');
  }
};

const getOrderById = (orderId: string) => getState().orders.find((order) => order.id === orderId) || null;

const normalizeShippingAddress = (order: AdminOrder) => {
  const shipping = (order.shippingAddress || {}) as Record<string, unknown>;
  const line1 = String(shipping.line1 || '').trim();
  const line2 = String(shipping.line2 || '').trim();
  const city = String(shipping.city || '').trim();
  const state = String(shipping.state || '').trim();
  const postalCode = String(shipping.postal_code || shipping.postalCode || '').trim();
  const country = String(shipping.country || 'US').trim() || 'US';
  const phone = String(shipping.phone || '').trim();
  return {
    name: String(shipping.name || order.shippingName || order.customerName || 'Customer').trim() || 'Customer',
    email: order.customerEmail || null,
    phone,
    line1,
    line2: line2 || null,
    city,
    state,
    postalCode,
    country,
  };
};

const getShipmentArray = (orderId: string): OrderShipment[] => getState().orderShipments[orderId] || [];

const nextParcelIndex = (orderId: string): number => getShipmentArray(orderId).length + 1;

const findPreset = (presetId: string | null | undefined): ShippingBoxPreset | null => {
  if (!presetId) return null;
  return getState().shippingSettings.boxPresets.find((preset) => preset.id === presetId) || null;
};

const effectiveDimensions = (
  payload: {
    boxPresetId?: string | null;
    customLengthIn?: number | null;
    customWidthIn?: number | null;
    customHeightIn?: number | null;
    weightLb?: number | null;
  },
  fallback?: OrderShipment | null
) => {
  const preset = findPreset(payload.boxPresetId ?? fallback?.boxPresetId ?? null);
  const lengthIn = payload.customLengthIn ?? fallback?.customLengthIn ?? preset?.lengthIn ?? null;
  const widthIn = payload.customWidthIn ?? fallback?.customWidthIn ?? preset?.widthIn ?? null;
  const heightIn = payload.customHeightIn ?? fallback?.customHeightIn ?? preset?.heightIn ?? null;
  const weightLb = payload.weightLb ?? fallback?.weightLb ?? preset?.defaultWeightLb ?? null;
  return {
    preset,
    lengthIn,
    widthIn,
    heightIn,
    weightLb,
  };
};

const buildShipment = (
  orderId: string,
  parcelIndex: number,
  payload: {
    boxPresetId?: string | null;
    customLengthIn?: number | null;
    customWidthIn?: number | null;
    customHeightIn?: number | null;
    weightLb?: number | null;
  },
  fallback?: OrderShipment | null
): OrderShipment => {
  const dims = effectiveDimensions(payload, fallback);
  const id = fallback?.id || demoId('ship');
  return {
    id,
    orderId,
    parcelIndex,
    boxPresetId: payload.boxPresetId ?? fallback?.boxPresetId ?? null,
    boxPresetName: dims.preset?.name || fallback?.boxPresetName || null,
    customLengthIn: payload.customLengthIn ?? fallback?.customLengthIn ?? null,
    customWidthIn: payload.customWidthIn ?? fallback?.customWidthIn ?? null,
    customHeightIn: payload.customHeightIn ?? fallback?.customHeightIn ?? null,
    weightLb: Number(dims.weightLb || 0),
    easyshipShipmentId: fallback?.easyshipShipmentId || null,
    easyshipLabelId: fallback?.easyshipLabelId || null,
    carrier: fallback?.carrier || null,
    service: fallback?.service || null,
    trackingNumber: fallback?.trackingNumber || null,
    labelUrl: fallback?.labelUrl || null,
    labelCostAmountCents: fallback?.labelCostAmountCents || null,
    labelCurrency: fallback?.labelCurrency || 'USD',
    labelState: fallback?.labelState || 'pending',
    quoteSelectedId: fallback?.quoteSelectedId || null,
    errorMessage: null,
    createdAt: fallback?.createdAt || nowIso(),
    purchasedAt: fallback?.purchasedAt || null,
    updatedAt: nowIso(),
    effectiveLengthIn: dims.lengthIn,
    effectiveWidthIn: dims.widthIn,
    effectiveHeightIn: dims.heightIn,
  };
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => null)) as any;
  if (!response.ok) {
    const detail = data?.error || data?.detail || data?.code || `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return (data || {}) as T;
};

export async function listOrders(): Promise<{ orders: AdminOrder[]; unseenCount: number }> {
  ensureDemo();
  const orders = clone(getState().orders);
  const unseenCount = orders.reduce((count, order) => count + (order.isSeen === false ? 1 : 0), 0);
  return { orders, unseenCount };
}

export async function markOrderSeen(orderId: string): Promise<{ unseenCount: number }> {
  ensureDemo();
  const orders = getState().orders.map((order) =>
    order.id === orderId ? { ...order, isSeen: true, seenAt: nowIso() } : order
  );
  actions.setOrders(orders);
  return { unseenCount: orders.reduce((count, order) => count + (order.isSeen === false ? 1 : 0), 0) };
}

export async function listMessages(): Promise<{ messages: any[]; unreadCount: number }> {
  ensureDemo();
  const messages = clone(getState().messages);
  const unreadCount = messages.reduce((count, message) => count + (message.isRead ? 0 : 1), 0);
  return { messages, unreadCount };
}

export async function markMessageRead(id: string): Promise<{ unreadCount: number }> {
  ensureDemo();
  const updated = getState().messages.map((message) =>
    message.id === id ? { ...message, isRead: true, readAt: nowIso() } : message
  );
  actions.setMessages(updated);
  return { unreadCount: updated.reduce((count, message) => count + (message.isRead ? 0 : 1), 0) };
}

export async function deleteMessage(id: string): Promise<void> {
  ensureDemo();
  const updated = getState().messages.filter((message) => message.id !== id);
  actions.setMessages(updated);
}

export async function listSoldProducts(): Promise<Product[]> {
  ensureDemo();
  return clone(getState().soldProducts);
}

export async function listProducts(): Promise<Product[]> {
  ensureDemo();
  return clone(getState().products);
}

export async function createProduct(payload: Partial<Product> & { name: string; description: string }): Promise<Product> {
  ensureDemo();
  const imageUrl = payload.imageUrl || payload.imageUrls?.[0] || '';
  const imageUrls = payload.imageUrls?.length ? payload.imageUrls : imageUrl ? [imageUrl] : [];
  const product: Product = {
    id: demoId('prod'),
    stripeProductId: null,
    stripePriceId: null,
    name: payload.name,
    slug: payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    description: payload.description,
    imageUrl,
    imageUrls,
    primaryImageId: payload.primaryImageId,
    imageIds: payload.imageIds || [],
    thumbnailUrl: imageUrl || undefined,
    type: payload.type || payload.category || 'Keepsakes',
    category: payload.category || payload.type || 'Keepsakes',
    categories: payload.categories || [payload.category || payload.type || 'Keepsakes'],
    collection: payload.collection,
    oneoff: payload.oneoff ?? true,
    quantityAvailable: payload.quantityAvailable ?? 1,
    visible: payload.visible ?? true,
    isSold: false,
    priceCents: payload.priceCents ?? 0,
    shippingOverrideEnabled: payload.shippingOverrideEnabled ?? false,
    shippingOverrideAmountCents: payload.shippingOverrideAmountCents ?? null,
  };
  actions.addProduct(product);
  return clone(product);
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
  ensureDemo();
  const updated = actions.updateProduct(id, patch);
  return updated ? clone(updated) : null;
}

export async function deleteProduct(id: string): Promise<void> {
  ensureDemo();
  actions.deleteProduct(id);
}

export async function listCategories(): Promise<Category[]> {
  ensureDemo();
  return clone(getState().categories);
}

export async function createCategory(payload: Partial<Category> & { name: string }): Promise<Category> {
  ensureDemo();
  const category: Category = {
    id: demoId('cat'),
    name: payload.name.trim(),
    subtitle: payload.subtitle || '',
    slug: payload.slug || payload.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    imageUrl: payload.imageUrl,
    heroImageUrl: payload.heroImageUrl,
    imageId: payload.imageId,
    heroImageId: payload.heroImageId,
    showOnHomePage: payload.showOnHomePage ?? false,
    shippingCents: payload.shippingCents ?? 0,
    sortOrder: payload.sortOrder ?? getState().categories.length,
    optionGroupLabel: payload.optionGroupLabel ?? null,
    optionGroupOptions: payload.optionGroupOptions || [],
  };
  actions.setCategories([...getState().categories, category].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
  return clone(category);
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<Category | null> {
  ensureDemo();
  const categories = getState().categories.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
  actions.setCategories(categories);
  const updated = categories.find((entry) => entry.id === id) || null;
  return updated ? clone(updated) : null;
}

export async function deleteCategory(id: string): Promise<void> {
  ensureDemo();
  actions.setCategories(getState().categories.filter((entry) => entry.id !== id));
}

export async function listPromotions(): Promise<Promotion[]> {
  ensureDemo();
  return clone(getState().promotions);
}

export async function createPromotion(payload: Partial<Promotion> & { name: string; percentOff: number }): Promise<Promotion> {
  ensureDemo();
  const promotion: Promotion = {
    id: demoId('promo'),
    name: payload.name,
    percentOff: payload.percentOff,
    scope: payload.scope || 'global',
    categorySlugs: payload.categorySlugs || [],
    bannerEnabled: payload.bannerEnabled ?? false,
    bannerText: payload.bannerText || '',
    startsAt: payload.startsAt ?? null,
    endsAt: payload.endsAt ?? null,
    enabled: payload.enabled ?? false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  actions.addPromotion(promotion);
  return clone(promotion);
}

export async function updatePromotion(id: string, patch: Partial<Promotion>): Promise<Promotion> {
  ensureDemo();
  const updated = actions.updatePromotion(id, patch);
  if (!updated) throw new Error('Promotion not found');
  return clone(updated);
}

export async function deletePromotion(id: string): Promise<void> {
  ensureDemo();
  actions.deletePromotion(id);
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  ensureDemo();
  return clone(getState().promoCodes);
}

export async function createPromoCode(payload: Partial<PromoCode> & { code: string }): Promise<PromoCode> {
  ensureDemo();
  const promoCode: PromoCode = {
    id: demoId('code'),
    code: payload.code.toUpperCase(),
    enabled: payload.enabled ?? true,
    percentOff: payload.percentOff ?? null,
    freeShipping: payload.freeShipping ?? false,
    scope: payload.scope || 'global',
    categorySlugs: payload.categorySlugs || [],
    startsAt: payload.startsAt ?? null,
    endsAt: payload.endsAt ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  actions.setPromoCodes([promoCode, ...getState().promoCodes]);
  return clone(promoCode);
}

export async function updatePromoCode(id: string, patch: Partial<PromoCode>): Promise<PromoCode> {
  ensureDemo();
  const promoCodes = getState().promoCodes.map((entry) =>
    entry.id === id ? { ...entry, ...patch, updatedAt: nowIso() } : entry
  );
  actions.setPromoCodes(promoCodes);
  const updated = promoCodes.find((entry) => entry.id === id);
  if (!updated) throw new Error('Promo code not found');
  return clone(updated);
}

export async function deletePromoCode(id: string): Promise<void> {
  ensureDemo();
  actions.setPromoCodes(getState().promoCodes.filter((entry) => entry.id !== id));
}

export async function listCustomOrders(): Promise<AdminCustomOrder[]> {
  ensureDemo();
  return clone(getState().customOrders);
}

export async function createCustomOrder(payload: Partial<AdminCustomOrder> & { customerName: string; customerEmail: string; description: string }): Promise<AdminCustomOrder> {
  ensureDemo();
  const nextId = demoId('co');
  const numeric = typeof payload.amount === 'number' ? payload.amount : Number(payload.amount || 0);
  const order: AdminCustomOrder = {
    id: nextId,
    displayCustomOrderId: `DCO-${nextId.slice(-6).toUpperCase()}`,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    description: payload.description,
    imageUrl: payload.imageUrl || null,
    imageId: payload.imageId || null,
    imageStorageKey: payload.imageStorageKey || null,
    amount: Number.isFinite(numeric) ? Math.round(numeric) : 0,
    shippingCents: typeof payload.shippingCents === 'number' ? payload.shippingCents : 0,
    showOnSoldProducts: payload.showOnSoldProducts === true,
    status: payload.status || 'pending',
    paymentLink: payload.paymentLink || null,
    createdAt: nowIso(),
    archived: false,
    archivedAt: null,
  };
  actions.addCustomOrder(order);
  return clone(order);
}

export async function updateCustomOrder(id: string, patch: Partial<AdminCustomOrder>): Promise<void> {
  ensureDemo();
  const updated = actions.updateCustomOrder(id, patch);
  if (!updated) throw new Error('Custom order not found');
}

export async function archiveCustomOrder(id: string): Promise<AdminCustomOrder> {
  ensureDemo();
  const updated = actions.updateCustomOrder(id, { archived: true, archivedAt: nowIso() });
  if (!updated) throw new Error('Custom order not found');
  actions.removeCustomOrder(id);
  return clone(updated);
}

export async function sendCustomOrderPaymentLink(id: string): Promise<{ paymentLink: string; sessionId: string; emailOk?: boolean }> {
  ensureDemo();
  const sessionId = demoId('stripe_session');
  const paymentLink = `https://checkout.stripe.com/c/pay/${sessionId}`;
  const updated = actions.updateCustomOrder(id, { paymentLink, status: 'pending' });
  if (!updated) throw new Error('Custom order not found');
  return { paymentLink, sessionId, emailOk: true };
}

export async function listEmailList(): Promise<EmailListItem[]> {
  ensureDemo();
  return clone(getState().emailList);
}

export async function getHomeContent(): Promise<HomeSiteContent> {
  ensureDemo();
  return clone(getState().homeContent);
}

export async function setHomeContent(homeContent: HomeSiteContent): Promise<HomeSiteContent> {
  ensureDemo();
  actions.setHomeContent(homeContent);
  return clone(homeContent);
}

export async function listGalleryImages(): Promise<any[]> {
  ensureDemo();
  return clone(getState().galleryImages);
}

export async function saveGalleryImages(images: any[]): Promise<any[]> {
  ensureDemo();
  actions.setGalleryImages(images);
  return clone(getState().galleryImages);
}

export async function listCustomOrderExamples(): Promise<SeedCustomOrderExample[]> {
  ensureDemo();
  return clone(getState().customOrderExamples);
}

export async function saveCustomOrderExamples(examples: SeedCustomOrderExample[]): Promise<SeedCustomOrderExample[]> {
  ensureDemo();
  actions.setCustomOrderExamples(examples);
  return clone(getState().customOrderExamples);
}

export async function uploadImage(file: File): Promise<{ id: string; url: string; imageId?: string | null; storageKey?: string }> {
  ensureDemo();
  const asset = actions.addImageAsset(file);
  return {
    id: asset.id,
    imageId: asset.id,
    url: asset.objectUrl,
    storageKey: `demo/${asset.id}/${asset.name}`,
  };
}

export async function deleteImage(id: string): Promise<void> {
  ensureDemo();
  actions.removeImageAsset(id);
}

export async function getShippingSettings(): Promise<{ shipFrom: ShipFromSettings; boxPresets: ShippingBoxPreset[] }> {
  ensureDemo();
  return clone(getState().shippingSettings);
}

export async function updateShipFrom(payload: Partial<ShipFromSettings>): Promise<ShipFromSettings> {
  ensureDemo();
  const shipFrom = { ...getState().shippingSettings.shipFrom, ...payload, updatedAt: nowIso() };
  actions.setShippingSettings(shipFrom);
  return clone(shipFrom);
}

export async function createBoxPreset(payload: {
  name: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  defaultWeightLb?: number | null;
}): Promise<ShippingBoxPreset[]> {
  ensureDemo();
  const next: ShippingBoxPreset = {
    id: demoId('box'),
    name: payload.name,
    lengthIn: payload.lengthIn,
    widthIn: payload.widthIn,
    heightIn: payload.heightIn,
    defaultWeightLb: payload.defaultWeightLb ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  actions.setPackages([...getState().shippingSettings.boxPresets, next]);
  return clone(getState().shippingSettings.boxPresets);
}

export async function updateBoxPreset(
  id: string,
  payload: {
    name: string;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
    defaultWeightLb?: number | null;
  }
): Promise<ShippingBoxPreset[]> {
  ensureDemo();
  const next = getState().shippingSettings.boxPresets.map((preset) =>
    preset.id === id ? { ...preset, ...payload, updatedAt: nowIso() } : preset
  );
  actions.setPackages(next);
  return clone(getState().shippingSettings.boxPresets);
}

export async function deleteBoxPreset(id: string): Promise<ShippingBoxPreset[]> {
  ensureDemo();
  actions.setPackages(getState().shippingSettings.boxPresets.filter((preset) => preset.id !== id));
  return clone(getState().shippingSettings.boxPresets);
}

const getDemoShipmentContext = (orderId: string, shipmentId: string) => {
  if (!orderId.startsWith('seed_order_')) {
    throw new Error('Demo labels are only available for seeded demo orders.');
  }
  const order = getOrderById(orderId);
  const shipment = getShipmentArray(orderId).find((entry) => entry.id === shipmentId) || null;
  const shipFrom = getState().shippingSettings.shipFrom;
  if (!order) throw new Error('Order not found');
  if (!shipment) throw new Error('Shipment not found');
  return { order, shipment, shipFrom };
};

export async function listOrderShipments(orderId: string): Promise<{ shipments: OrderShipment[]; summary: { actualLabelTotalCents: number } }> {
  ensureDemo();
  const shipments = clone(getShipmentArray(orderId));
  const actualLabelTotalCents = shipments.reduce((sum, shipment) => sum + (shipment.labelCostAmountCents || 0), 0);
  return { shipments, summary: { actualLabelTotalCents } };
}

export async function createOrderShipment(
  orderId: string,
  payload: {
    boxPresetId?: string | null;
    customLengthIn?: number | null;
    customWidthIn?: number | null;
    customHeightIn?: number | null;
    weightLb?: number | null;
  }
): Promise<{ shipment: OrderShipment | null; shipments: OrderShipment[] }> {
  ensureDemo();
  const shipment = buildShipment(orderId, nextParcelIndex(orderId), payload);
  actions.addOrderShipment(orderId, shipment);
  const shipments = clone(getShipmentArray(orderId));
  return { shipment: clone(shipment), shipments };
}

export async function updateOrderShipment(
  orderId: string,
  shipmentId: string,
  payload: {
    boxPresetId?: string | null;
    customLengthIn?: number | null;
    customWidthIn?: number | null;
    customHeightIn?: number | null;
    weightLb?: number | null;
  }
): Promise<{ shipment: OrderShipment | null; shipments: OrderShipment[] }> {
  ensureDemo();
  const current = getShipmentArray(orderId).find((entry) => entry.id === shipmentId) || null;
  if (!current) throw new Error('Shipment not found');
  const shipment = buildShipment(orderId, current.parcelIndex, payload, current);
  actions.updateOrderShipment(orderId, shipment);
  return { shipment: clone(shipment), shipments: clone(getShipmentArray(orderId)) };
}

export async function deleteOrderShipment(orderId: string, shipmentId: string): Promise<OrderShipment[]> {
  ensureDemo();
  actions.removeOrderShipment(orderId, shipmentId);
  return clone(getShipmentArray(orderId));
}

export async function fetchShipmentQuotes(orderId: string, shipmentId: string): Promise<{
  rates: ShipmentQuote[];
  selectedQuoteId: string | null;
  cached: boolean;
  expiresAt: string | null;
  warning: string | null;
  rawResponseHints: ShipmentQuoteDebugHints | null;
  shipments: OrderShipment[];
}> {
  ensureDemo();
  const { order, shipment, shipFrom } = getDemoShipmentContext(orderId, shipmentId);
  const data = await fetchJson<any>(`/api/admin/orders/${encodeURIComponent(orderId)}/shipments/${encodeURIComponent(shipmentId)}/quotes`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      demoOrder: {
        id: order.id,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        shippingAddress: normalizeShippingAddress(order),
        items: order.items,
      },
      demoShipment: shipment,
      demoShipFrom: shipFrom,
    }),
  });

  const rates = Array.isArray(data.rates) ? (data.rates as ShipmentQuote[]) : [];
  const selectedQuoteId = typeof data.selectedQuoteId === 'string' ? data.selectedQuoteId : null;
  const updatedShipment = { ...shipment, quoteSelectedId: selectedQuoteId };
  actions.updateOrderShipment(orderId, updatedShipment);
  actions.setOrderQuotes(shipmentId, rates);

  return {
    rates,
    selectedQuoteId,
    cached: false,
    expiresAt: null,
    warning: typeof data.warning === 'string' ? data.warning : null,
    rawResponseHints: data.rawResponseHints || null,
    shipments: clone(getShipmentArray(orderId)),
  };
}

export async function buyShipmentLabel(
  orderId: string,
  shipmentId: string,
  payload?: { quoteSelectedId?: string | null; refresh?: boolean }
): Promise<{
  shipment: OrderShipment | null;
  shipments: OrderShipment[];
  selectedQuoteId: string | null;
  pendingRefresh: boolean;
  refreshed?: boolean;
}> {
  ensureDemo();
  const { order, shipment, shipFrom } = getDemoShipmentContext(orderId, shipmentId);
  const data = await fetchJson<any>(`/api/admin/orders/${encodeURIComponent(orderId)}/shipments/${encodeURIComponent(shipmentId)}/buy`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      quoteSelectedId: payload?.quoteSelectedId || null,
      refresh: payload?.refresh === true,
      demoOrder: {
        id: order.id,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        shippingAddress: normalizeShippingAddress(order),
        items: order.items,
      },
      demoShipment: shipment,
      demoShipFrom: shipFrom,
      demoRates: getState().orderQuotes[shipmentId] || [],
    }),
  });

  const updatedShipment = (data.shipment || null) as OrderShipment | null;
  if (updatedShipment) {
    actions.updateOrderShipment(orderId, updatedShipment);
    if (updatedShipment.labelUrl) {
      actions.attachLabelToOrder(orderId, {
        shipmentId: updatedShipment.id,
        labelUrl: updatedShipment.labelUrl,
        carrier: updatedShipment.carrier,
        service: updatedShipment.service,
        trackingNumber: updatedShipment.trackingNumber,
        labelCostAmountCents: updatedShipment.labelCostAmountCents,
        labelCurrency: updatedShipment.labelCurrency || 'USD',
        createdAt: nowIso(),
      });
    }
  }

  return {
    shipment: updatedShipment ? clone(updatedShipment) : null,
    shipments: clone(getShipmentArray(orderId)),
    selectedQuoteId:
      typeof data.selectedQuoteId === 'string'
        ? data.selectedQuoteId
        : updatedShipment?.quoteSelectedId || payload?.quoteSelectedId || null,
    pendingRefresh: !!data.pendingRefresh,
    refreshed: data.refreshed === true,
  };
}

export async function fetchShipmentLabelStatus(orderId: string, shipmentId: string): Promise<{
  shipment: OrderShipment | null;
  shipments: OrderShipment[];
  pendingRefresh: boolean;
  refreshed?: boolean;
}> {
  ensureDemo();
  return buyShipmentLabel(orderId, shipmentId, { refresh: true });
}

export async function listOrderQuotes(shipmentId: string): Promise<ShipmentQuote[]> {
  ensureDemo();
  return clone(getState().orderQuotes[shipmentId] || []);
}

export const formatDemoProductPrice = (product: Product) => toPriceLabel(product.priceCents);


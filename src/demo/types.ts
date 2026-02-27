import type { OrderShipment, ShippingBoxPreset, ShipFromSettings, ShipmentQuote } from '../lib/adminShipping';

export type DemoImageAsset = {
  id: string;
  name: string;
  size: number;
  type: string;
  objectUrl: string;
  createdAt: string;
};

export type DemoMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  imageUrl?: string | null;
  createdAt: string;
  status?: string;
  type?: 'message' | 'custom_order' | string;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryIds?: string[];
  categoryNames?: string[];
  isRead?: boolean;
  readAt?: string | null;
  inspoExampleId?: string | null;
  inspoTitle?: string | null;
  inspoImageUrl?: string | null;
};

export type DemoOrderLabel = {
  shipmentId: string;
  labelUrl: string | null;
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  labelCostAmountCents: number | null;
  labelCurrency: string;
  createdAt: string;
};

export type DemoShippingState = {
  shipFrom: ShipFromSettings;
  boxPresets: ShippingBoxPreset[];
};

export type DemoShipmentMap = Record<string, OrderShipment[]>;
export type DemoQuoteMap = Record<string, ShipmentQuote[]>;
export type DemoOrderLabelsMap = Record<string, DemoOrderLabel[]>;

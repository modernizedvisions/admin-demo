import { requireAdmin } from '../../../../../_lib/adminAuth';
import {
  buildRateCacheSignaturePayload,
  fetchEasyshipRates,
  filterAllowedRates,
  getAllowedCarriers,
  isEasyshipDebugEnabled,
  normalizeRateForClient,
  pickCheapestRate,
  type EasyshipRawResponseHints,
  type EasyshipRateRequest,
} from '../../../../../_lib/easyship';
import {
  digestHex,
  ensureShippingLabelsSchema,
  getOrderDestination,
  getOrderItemsForEasyship,
  getOrderShipment,
  hasRequiredDestination,
  jsonResponse,
  listOrderShipments,
  orderExists,
  readShippingSettings,
  resolveShipmentDimensions,
  type EasyshipOrderItem,
  validateShipFrom,
  type ShippingLabelsEnv,
} from '../../../../../_lib/shippingLabels';
import { isDemoEnv } from '../../../../../_lib/demoGuard';

type CacheRow = {
  id: string;
  rates_json: string;
  expires_at: string;
};

const NO_SHIPPING_SOLUTIONS_WARNING = 'No shipping solutions available based on the information provided';

const getRouteParams = (request: Request): { orderId: string; shipmentId: string } | null => {
  const pathname = new URL(request.url).pathname;
  const match = pathname.match(/\/api\/admin\/orders\/([^/]+)\/shipments\/([^/]+)\/quotes$/);
  if (!match?.[1] || !match?.[2]) return null;
  return {
    orderId: decodeURIComponent(match[1]),
    shipmentId: decodeURIComponent(match[2]),
  };
};

const toEasyshipRateRequest = (
  shipFrom: Awaited<ReturnType<typeof readShippingSettings>>,
  destination: NonNullable<Awaited<ReturnType<typeof getOrderDestination>>>,
  dimensions: NonNullable<ReturnType<typeof resolveShipmentDimensions>>,
  items: EasyshipOrderItem[]
): EasyshipRateRequest => ({
  origin: {
    name: shipFrom.shipFromName,
    companyName: shipFrom.shipFromCompany || 'Dover Designs',
    phone: shipFrom.shipFromPhone || null,
    addressLine1: shipFrom.shipFromAddress1,
    addressLine2: shipFrom.shipFromAddress2 || null,
    city: shipFrom.shipFromCity,
    state: shipFrom.shipFromState,
    postalCode: shipFrom.shipFromPostal,
    countryCode: shipFrom.shipFromCountry || 'US',
  },
  destination: {
    name: destination.name || 'Customer',
    companyName: destination.companyName || null,
    email: destination.email || null,
    phone: destination.phone || null,
    addressLine1: destination.line1 || '',
    addressLine2: destination.line2 || null,
    city: destination.city || '',
    state: destination.state || '',
    postalCode: destination.postalCode || '',
    countryCode: destination.country || 'US',
  },
  dimensions,
  items: items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    declaredValueCents: item.declaredValueCents,
  })),
});

const parseCachedRates = (raw: string): ReturnType<typeof normalizeRateForClient>[] => {
  try {
    const decoded = JSON.parse(raw);
    if (!Array.isArray(decoded)) return [];
    return decoded.filter((entry) => entry && typeof entry === 'object');
  } catch {
    return [];
  }
};

const getRawCarrierName = (rate: { carrier: string; raw: unknown }): string => {
  if (rate.raw && typeof rate.raw === 'object' && !Array.isArray(rate.raw)) {
    const raw = rate.raw as Record<string, unknown>;
    if (typeof raw.courier_name === 'string') return raw.courier_name;
    if (typeof raw.carrier === 'string') return raw.carrier;
    if (typeof raw.provider === 'string') return raw.provider;
    if (raw.courier && typeof raw.courier === 'object' && !Array.isArray(raw.courier)) {
      const courier = raw.courier as Record<string, unknown>;
      if (typeof courier.name === 'string') return courier.name;
      if (typeof courier.display_name === 'string') return courier.display_name;
    }
  }
  return rate.carrier;
};

const maybeDebugHints = (rawResponseHints: EasyshipRawResponseHints | undefined): Record<string, unknown> =>
  rawResponseHints
    ? {
        rawResponseHints,
      }
    : {};

const trimOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toPositiveNumberOrNull = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
};

const buildDemoOrderItems = (value: unknown): EasyshipOrderItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const quantityRaw = Number(row.quantity);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
      const declaredValueRaw = Number(row.priceCents);
      const declaredValueCents =
        Number.isFinite(declaredValueRaw) && declaredValueRaw >= 0 ? Math.round(declaredValueRaw) : 1;
      return {
        description: trimOrNull(row.productName) || 'Order item',
        quantity,
        declaredValueCents,
      };
    })
    .filter((item): item is EasyshipOrderItem => !!item);
};

const toDemoQuoteContext = (params: { orderId: string; shipmentId: string }, body: Record<string, unknown> | null) => {
  const demoOrder = (body?.demoOrder || null) as Record<string, unknown> | null;
  const demoShipment = (body?.demoShipment || null) as Record<string, unknown> | null;
  const demoShipFrom = (body?.demoShipFrom || null) as Record<string, unknown> | null;
  if (!demoOrder || !demoShipment || !demoShipFrom) {
    return { error: 'Missing demoOrder, demoShipment, or demoShipFrom payload.' } as const;
  }

  const shippingAddress = (demoOrder.shippingAddress || null) as Record<string, unknown> | null;
  const destination = {
    name: trimOrNull(shippingAddress?.name) || trimOrNull(demoOrder.customerName) || 'Customer',
    companyName: trimOrNull(shippingAddress?.companyName),
    email: trimOrNull(shippingAddress?.email) || trimOrNull(demoOrder.customerEmail),
    phone: trimOrNull(shippingAddress?.phone),
    line1: trimOrNull(shippingAddress?.line1),
    line2: trimOrNull(shippingAddress?.line2),
    city: trimOrNull(shippingAddress?.city),
    state: trimOrNull(shippingAddress?.state),
    postalCode: trimOrNull(shippingAddress?.postalCode) || trimOrNull(shippingAddress?.postal_code),
    country: (trimOrNull(shippingAddress?.country) || 'US').toUpperCase(),
  };
  if (!hasRequiredDestination(destination)) {
    return { error: 'Order shipping destination is incomplete.' } as const;
  }

  const dimensions = {
    lengthIn:
      toPositiveNumberOrNull(demoShipment.effectiveLengthIn) ??
      toPositiveNumberOrNull(demoShipment.customLengthIn) ??
      toPositiveNumberOrNull(demoShipment.lengthIn),
    widthIn:
      toPositiveNumberOrNull(demoShipment.effectiveWidthIn) ??
      toPositiveNumberOrNull(demoShipment.customWidthIn) ??
      toPositiveNumberOrNull(demoShipment.widthIn),
    heightIn:
      toPositiveNumberOrNull(demoShipment.effectiveHeightIn) ??
      toPositiveNumberOrNull(demoShipment.customHeightIn) ??
      toPositiveNumberOrNull(demoShipment.heightIn),
    weightLb: toPositiveNumberOrNull(demoShipment.weightLb),
  };
  if (!dimensions.lengthIn || !dimensions.widthIn || !dimensions.heightIn || !dimensions.weightLb) {
    return { error: 'Shipment is missing dimensions or weight.' } as const;
  }

  const shipFrom = {
    shipFromName: trimOrNull(demoShipFrom.shipFromName) || '',
    shipFromCompany: trimOrNull(demoShipFrom.shipFromCompany) || 'Dover Designs',
    shipFromAddress1: trimOrNull(demoShipFrom.shipFromAddress1) || '',
    shipFromAddress2: trimOrNull(demoShipFrom.shipFromAddress2) || '',
    shipFromCity: trimOrNull(demoShipFrom.shipFromCity) || '',
    shipFromState: trimOrNull(demoShipFrom.shipFromState) || '',
    shipFromPostal: trimOrNull(demoShipFrom.shipFromPostal) || '',
    shipFromCountry: (trimOrNull(demoShipFrom.shipFromCountry) || 'US').toUpperCase(),
    shipFromPhone: trimOrNull(demoShipFrom.shipFromPhone) || '',
    updatedAt: null,
  };

  const missingShipFrom = validateShipFrom(shipFrom);
  if (missingShipFrom.length) {
    return {
      error: 'Ship-from settings are incomplete.',
      missingShipFrom,
    } as const;
  }

  return {
    orderId: trimOrNull(demoOrder.id) || params.orderId,
    shipmentId: trimOrNull(demoShipment.id) || params.shipmentId,
    shipFrom,
    destination,
    dimensions: {
      lengthIn: dimensions.lengthIn,
      widthIn: dimensions.widthIn,
      heightIn: dimensions.heightIn,
      weightLb: dimensions.weightLb,
    },
    items: buildDemoOrderItems(demoOrder.items),
    shipment: demoShipment,
  } as const;
};

export async function onRequestPost(
  context: { request: Request; env: ShippingLabelsEnv & Record<string, string | undefined> }
): Promise<Response> {
  const unauthorized = await requireAdmin(context.request, context.env as any);
  if (unauthorized) return unauthorized;
  const params = getRouteParams(context.request);
  if (!params) return jsonResponse({ ok: false, error: 'Missing orderId or shipmentId' }, 400);

  try {
    if (isDemoEnv(context.env as Record<string, unknown>)) {
      const body = (await context.request.json().catch(() => null)) as Record<string, unknown> | null;
      const demo = toDemoQuoteContext(params, body);
      if ('error' in demo) {
        return jsonResponse(
          {
            ok: false,
            error: demo.error,
            ...(demo.missingShipFrom ? { missing: demo.missingShipFrom } : {}),
          },
          400
        );
      }

      const allowedCarriers = getAllowedCarriers(context.env);
      const rateRequest = toEasyshipRateRequest(demo.shipFrom, demo.destination, demo.dimensions, demo.items);
      const signaturePayload = buildRateCacheSignaturePayload({
        orderId: demo.orderId,
        destination: rateRequest.destination,
        dimensions: rateRequest.dimensions,
        allowedCarriers,
      });
      const shipmentTempKey = await digestHex(signaturePayload);
      const liveRates = await fetchEasyshipRates(context.env, rateRequest);
      const rawRates = liveRates.rates;
      const allowedRates = filterAllowedRates(rawRates, allowedCarriers).sort((a, b) => a.amountCents - b.amountCents);

      if (!rawRates.length) {
        return jsonResponse({
          ok: true,
          cached: false,
          shipmentTempKey,
          expiresAt: null,
          rates: [],
          selectedQuoteId: null,
          warning: liveRates.warning || NO_SHIPPING_SOLUTIONS_WARNING,
          shipments: [{ ...demo.shipment, quoteSelectedId: null, updatedAt: new Date().toISOString() }],
          ...maybeDebugHints(liveRates.rawResponseHints),
        });
      }

      if (!allowedRates.length) {
        return jsonResponse(
          {
            ok: false,
            code: 'NO_QUOTES',
            error: 'No supported carrier quotes found for this parcel.',
            ...maybeDebugHints(liveRates.rawResponseHints),
          },
          422
        );
      }

      const normalizedRates = allowedRates.map(normalizeRateForClient);
      const cheapest = pickCheapestRate(allowedRates);
      const selectedQuoteId = cheapest?.id || null;
      return jsonResponse({
        ok: true,
        cached: false,
        shipmentTempKey,
        expiresAt: null,
        rates: normalizedRates,
        selectedQuoteId,
        shipments: [{ ...demo.shipment, quoteSelectedId: selectedQuoteId, updatedAt: new Date().toISOString() }],
        ...maybeDebugHints(liveRates.rawResponseHints),
      });
    }

    await ensureShippingLabelsSchema(context.env.DB);
    if (!(await orderExists(context.env.DB, params.orderId))) {
      return jsonResponse({ ok: false, error: 'Order not found' }, 404);
    }
    const shipment = await getOrderShipment(context.env.DB, params.orderId, params.shipmentId);
    if (!shipment) {
      return jsonResponse({ ok: false, error: 'Shipment not found' }, 404);
    }

    const shipFrom = await readShippingSettings(context.env.DB);
    const missingShipFrom = validateShipFrom(shipFrom);
    if (missingShipFrom.length) {
      return jsonResponse(
        {
          ok: false,
          code: 'SHIP_FROM_INCOMPLETE',
          error: 'Ship-from settings are incomplete.',
          missing: missingShipFrom,
        },
        400
      );
    }

    const destination = await getOrderDestination(context.env.DB, params.orderId);
    if (!hasRequiredDestination(destination)) {
      return jsonResponse(
        { ok: false, code: 'DESTINATION_INCOMPLETE', error: 'Order shipping destination is incomplete.' },
        400
      );
    }

    const dimensions = resolveShipmentDimensions(shipment);
    if (!dimensions) {
      return jsonResponse(
        { ok: false, code: 'PARCEL_INCOMPLETE', error: 'Shipment is missing dimensions or weight.' },
        400
      );
    }

    const orderItems = await getOrderItemsForEasyship(context.env.DB, params.orderId);
    const allowedCarriers = getAllowedCarriers(context.env);
    if (isEasyshipDebugEnabled(context.env)) {
      console.log('[easyship][debug] quotes carrier filter', {
        orderId: params.orderId,
        shipmentId: params.shipmentId,
        allowedCarrierCount: allowedCarriers.length,
        allowedCarriers,
      });
    }
    const rateRequest = toEasyshipRateRequest(shipFrom, destination!, dimensions, orderItems);
    const signaturePayload = buildRateCacheSignaturePayload({
      orderId: params.orderId,
      destination: rateRequest.destination,
      dimensions,
      allowedCarriers,
    });
    const shipmentTempKey = await digestHex(signaturePayload);
    const now = new Date();
    const nowIso = now.toISOString();

    const cached = await context.env.DB.prepare(
      `SELECT id, rates_json, expires_at
       FROM order_rate_quotes
       WHERE order_id = ? AND shipment_temp_key = ? AND expires_at > ?
       ORDER BY datetime(created_at) DESC
       LIMIT 1;`
    )
      .bind(params.orderId, shipmentTempKey, nowIso)
      .first<CacheRow>();
    if (cached?.rates_json) {
      const rates = parseCachedRates(cached.rates_json);
      const cheapest = [...rates].sort((a: any, b: any) => (a.amountCents || 0) - (b.amountCents || 0))[0] || null;
      if (cheapest?.id) {
        await context.env.DB.prepare(
          `UPDATE order_shipments
           SET quote_selected_id = ?, updated_at = ?
           WHERE id = ? AND order_id = ?;`
        )
          .bind(cheapest.id, nowIso, params.shipmentId, params.orderId)
          .run();
      }
      const shipments = await listOrderShipments(context.env.DB, params.orderId);
      return jsonResponse({
        ok: true,
        cached: true,
        expiresAt: cached.expires_at,
        shipmentTempKey,
        rates,
        selectedQuoteId: cheapest?.id || null,
        shipments,
      });
    }

    const liveRates = await fetchEasyshipRates(context.env, rateRequest);
    const rawRates = liveRates.rates;
    if (isEasyshipDebugEnabled(context.env)) {
      const resultShape = liveRates as unknown as Record<string, unknown>;
      const rateContainer = resultShape?.rates as unknown;
      console.log('[easyship][debug] quotes fetchEasyshipRates shape', {
        resultKeys: Object.keys(resultShape || {}),
        ratesIsArray: Array.isArray(rateContainer),
        ratesType: typeof rateContainer,
        nestedRatesKeys:
          !Array.isArray(rateContainer) && rateContainer && typeof rateContainer === 'object'
            ? Object.keys(rateContainer as Record<string, unknown>)
            : [],
        firstRateKeys:
          Array.isArray(rateContainer) && rateContainer[0] && typeof rateContainer[0] === 'object'
            ? Object.keys(rateContainer[0] as Record<string, unknown>)
            : [],
      });
    }
    const allowedRates = filterAllowedRates(rawRates, allowedCarriers).sort((a, b) => a.amountCents - b.amountCents);
    if (isEasyshipDebugEnabled(context.env)) {
      console.log('[easyship][debug] quotes rates pre/post filter', {
        orderId: params.orderId,
        shipmentId: params.shipmentId,
        rawRatesCount: rawRates.length,
        rawCarrierNames: rawRates.slice(0, 10).map((rate) => getRawCarrierName(rate)),
        rawCarrierServices: rawRates.slice(0, 10).map((rate) => ({
          carrier: rate.carrier,
          service: rate.service,
        })),
        filteredRatesCount: allowedRates.length,
        filteredCarrierServices: allowedRates.slice(0, 10).map((rate) => ({
          carrier: rate.carrier,
          service: rate.service,
        })),
        rawResponseHints: liveRates.rawResponseHints || null,
      });
    }
    if (!rawRates.length) {
      await context.env.DB.prepare(
        `UPDATE order_shipments
         SET quote_selected_id = NULL, updated_at = ?
         WHERE id = ? AND order_id = ?;`
      )
        .bind(nowIso, params.shipmentId, params.orderId)
        .run();
      const shipments = await listOrderShipments(context.env.DB, params.orderId);
      return jsonResponse({
        ok: true,
        cached: false,
        shipmentTempKey,
        expiresAt: null,
        rates: [],
        selectedQuoteId: null,
        warning: liveRates.warning || NO_SHIPPING_SOLUTIONS_WARNING,
        shipments,
        ...maybeDebugHints(liveRates.rawResponseHints),
      });
    }
    if (!allowedRates.length) {
      return jsonResponse(
        {
          ok: false,
          code: 'NO_QUOTES',
          error: 'No supported carrier quotes found for this parcel.',
          ...maybeDebugHints(liveRates.rawResponseHints),
        },
        422
      );
    }

    const normalizedRates = allowedRates.map(normalizeRateForClient);
    const cheapest = pickCheapestRate(allowedRates);
    const selectedQuoteId = cheapest?.id || null;
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    await context.env.DB.prepare(
      `INSERT INTO order_rate_quotes (id, order_id, shipment_temp_key, rates_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(order_id, shipment_temp_key) DO UPDATE SET
         rates_json = excluded.rates_json,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at;`
    )
      .bind(crypto.randomUUID(), params.orderId, shipmentTempKey, JSON.stringify(normalizedRates), nowIso, expiresAt)
      .run();

    await context.env.DB.prepare(
      `UPDATE order_shipments
       SET quote_selected_id = ?, updated_at = ?
       WHERE id = ? AND order_id = ?;`
    )
      .bind(selectedQuoteId, nowIso, params.shipmentId, params.orderId)
      .run();

    const shipments = await listOrderShipments(context.env.DB, params.orderId);
    return jsonResponse({
      ok: true,
      cached: false,
      shipmentTempKey,
      expiresAt,
      rates: normalizedRates,
      selectedQuoteId,
      shipments,
      ...maybeDebugHints(liveRates.rawResponseHints),
    });
  } catch (error) {
    console.error('[admin/orders/:orderId/shipments/:shipmentId/quotes] failed to fetch quotes', error);
    const detail = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, error: 'Failed to fetch quotes', detail }, 500);
  }
}

export async function onRequest(
  context: { request: Request; env: ShippingLabelsEnv & Record<string, string | undefined> }
): Promise<Response> {
  if (context.request.method.toUpperCase() !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }
  return onRequestPost(context);
}

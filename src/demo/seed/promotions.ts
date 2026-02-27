import type { PromoCode, Promotion } from '../../lib/types';

export const seedPromotions: Promotion[] = [
  {
    id: 'seed_promo_001',
    name: 'Spring Coastal Launch',
    percentOff: 10,
    scope: 'global',
    categorySlugs: [],
    bannerEnabled: true,
    bannerText: 'Spring launch: 10% off this week',
    startsAt: '2026-02-20T00:00:00.000Z',
    endsAt: '2026-03-03T23:59:59.000Z',
    enabled: true,
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: '2026-02-20T00:00:00.000Z',
  },
];

export const seedPromoCodes: PromoCode[] = [
  {
    id: 'seed_code_001',
    code: 'WELCOME5',
    enabled: true,
    percentOff: 5,
    freeShipping: false,
    scope: 'global',
    categorySlugs: [],
    startsAt: null,
    endsAt: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: 'seed_code_002',
    code: 'COASTAL10',
    enabled: true,
    percentOff: 10,
    freeShipping: true,
    scope: 'categories',
    categorySlugs: ['wedding', 'keepsakes'],
    startsAt: '2026-02-01T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
];

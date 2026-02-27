import type { GalleryImage, HomeSiteContent } from '../../lib/types';

export type SeedCustomOrderExample = {
  id: string;
  imageUrl: string;
  imageId?: string;
  title: string;
  description: string;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
};

export const seedHomeContent: HomeSiteContent = {
  heroImages: {
    left: 'https://picsum.photos/seed/demo-hero-1/900/1200',
    middle: 'https://picsum.photos/seed/demo-hero-2/900/1200',
    right: 'https://picsum.photos/seed/demo-hero-3/900/1200',
  },
  heroRotationEnabled: true,
  homeGallery: Array.from({ length: 8 }).map((_, idx) => ({
    imageUrl: `https://picsum.photos/seed/demo-home-${idx + 1}/700/900`,
    descriptor: `Collection ${idx + 1}`,
  })),
  aboutImages: {
    home: 'https://picsum.photos/seed/demo-about-home/900/1200',
    about: 'https://picsum.photos/seed/demo-about-page/900/1200',
  },
};

export const seedGalleryImages: GalleryImage[] = Array.from({ length: 8 }).map((_, idx) => ({
  id: `seed_gallery_${String(idx + 1).padStart(3, '0')}`,
  imageUrl: `https://picsum.photos/seed/demo-gallery-${idx + 1}/800/1000`,
  imageId: null as unknown as string,
  hidden: false,
  alt: `Gallery image ${idx + 1}`,
  position: idx,
  createdAt: '2026-02-20T00:00:00.000Z',
}));

export const seedCustomOrderExamples: SeedCustomOrderExample[] = Array.from({ length: 9 }).map((_, idx) => ({
  id: `seed_example_${String(idx + 1).padStart(3, '0')}`,
  imageUrl: `https://picsum.photos/seed/demo-custom-example-${idx + 1}/700/900`,
  title: `Example ${idx + 1}`,
  description: `Custom oyster shell example design ${idx + 1}.`,
  tags: ['custom', 'coastal'],
  sortOrder: idx,
  isActive: true,
}));

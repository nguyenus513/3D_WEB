'use client';

import dynamic from 'next/dynamic';
import { BentoGrid } from '@/components/user/BentoGrid';
import { FeaturedProducts } from '@/components/user/FeaturedProducts';
import { WhyUs, CTASection } from '@/components/user/Sections';
import { useContent } from '@/hooks/useContent';
import { useUiLabels } from '@/hooks/useUiLabels';

interface HeroBlockData {
  pretitle?: string;
  title?: string;
  highlight?: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  scrollLabel?: string;
}

interface ServicesBlockData {
  heading?: string;
  subheading?: string;
  ctaLabel?: string;
  items?: { id: string; title: string; description?: string; href: string }[];
}

interface FeaturedBlockData {
  heading?: string;
  subheading?: string;
  viewAllLabel?: string;
  quickViewLabel?: string;
}

interface FeaturesBlockData {
  heading?: string;
  items?: { title: string; description?: string }[];
}

interface CtaBlockData {
  title?: string;
  highlight?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

function HeroLoading() {
  const { t } = useUiLabels(['public.home', 'common']);
  const loadingText = t('hero_loading', '') as string;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
        <span className="text-white/30 text-sm">{loadingText}</span>
      </div>
    </div>
  );
}

const HeroJelly = dynamic(
  () => import('@/components/user/HeroJelly').then((mod) => mod.HeroJelly),
  {
    ssr: false,
    loading: () => <HeroLoading />,
  }
);

export default function HomePage() {
  const { getBlock } = useContent('home');

  const heroData = (getBlock('hero')?.data ?? {}) as HeroBlockData;
  const servicesData = (getBlock('services')?.data ?? {}) as ServicesBlockData;
  const featuredData = (getBlock('featured')?.data ?? {}) as FeaturedBlockData;
  const featuresData = (getBlock('features')?.data ?? {}) as FeaturesBlockData;
  const ctaData = (getBlock('cta')?.data ?? {}) as CtaBlockData;

  return (
    <div className="bg-[#0a0a0a]">
      <HeroJelly data={heroData} />
      <BentoGrid data={servicesData} />
      <FeaturedProducts data={featuredData} />
      <WhyUs data={featuresData} />
      <CTASection data={ctaData} />
    </div>
  );
}

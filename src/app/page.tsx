'use client';

import dynamic from 'next/dynamic';
import { BentoGrid } from '@/components/user/BentoGrid';
import { FeaturedProducts } from '@/components/user/FeaturedProducts';
import { WhyUs, CTASection } from '@/components/user/Sections';

// Dynamic import for 3D Hero with Jelly effect
const HeroJelly = dynamic(
  () => import('@/components/user/HeroJelly').then((mod) => mod.HeroJelly),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
          <span className="text-white/30 text-sm">Loading 3D Experience...</span>
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <div className="bg-[#0a0a0a]">
      {/* Hero with Jelly Distortion */}
      <HeroJelly />

      {/* Bento Grid - Services */}
      <BentoGrid />

      {/* Featured Products */}
      <FeaturedProducts />

      {/* Why Us */}
      <WhyUs />

      {/* CTA Section */}
      <CTASection />
    </div>
  );
}

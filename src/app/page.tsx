'use client';

import dynamic from 'next/dynamic';
import { BentoGrid } from '@/components/user/BentoGrid';
import { FeaturedProducts } from '@/components/user/FeaturedProducts';
import { WhyUs, CTASection } from '@/components/user/Sections';

// Dynamic import for 3D Hero to avoid SSR issues
const HeroSection = dynamic(
  () => import('@/components/user/HeroSection').then((mod) => mod.HeroSection),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/50 text-lg">Loading 3D Experience...</div>
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <div className="bg-black">
      {/* Hero Section with 3D */}
      <HeroSection />

      {/* Bento Grid - Services */}
      <BentoGrid />

      {/* Featured Products - Light Section */}
      <FeaturedProducts />

      {/* Why Us */}
      <WhyUs />

      {/* CTA Section */}
      <CTASection />
    </div>
  );
}

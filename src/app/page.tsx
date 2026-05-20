'use client';

import { MiniVersionShowcase } from '@/components/user/MiniVersionShowcase';
import { WhyUs } from '@/components/user/Sections';

export default function HomePage() {
  return (
    <div className="bg-[var(--bg-void)]">
      <MiniVersionShowcase />
      <WhyUs />
    </div>
  );
}

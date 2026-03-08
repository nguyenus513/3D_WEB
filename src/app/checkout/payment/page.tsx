
'use client';

import { Suspense } from 'react';
import { CheckoutContent } from '../page';

export default function PaymentPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--color-accent)] rounded-full animate-spin" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}


'use client';

import { Suspense } from 'react';
import CheckoutContent from '../page';

/**
 * Payment Page Wrapper
 * Reuses the CheckoutContent component but specifically for payment flow.
 * The CheckoutContent component already handles ?orderId param logic.
 */
export default function PaymentPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}

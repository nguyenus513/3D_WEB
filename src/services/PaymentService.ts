/**
 * Payment Service
 *
 * Business logic layer for payment processing.
 * Handles Stripe Payment Intents and bank transfer verification.
 *
 * @see stripe-integration skill for patterns
 */

// =============================================================================
// Types
// =============================================================================

export interface CreatePaymentIntentInput {
    orderId: string;
    amount: number;
    currency?: string;
    metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
}

export interface BankTransferInfo {
    orderId: string;
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferContent: string;
    qrCodeUrl?: string;
}

// =============================================================================
// Payment Service
// =============================================================================

export class PaymentService {
    private stripe: import('stripe').default | null = null;

    private async getStripe(): Promise<import('stripe').default> {
        if (!this.stripe) {
            const Stripe = (await import('stripe')).default;
            const secretKey = process.env.STRIPE_SECRET_KEY;

            if (!secretKey) {
                throw new Error('STRIPE_SECRET_KEY is not configured');
            }

            this.stripe = new Stripe(secretKey, {
                apiVersion: '2025-01-27.acacia',
            });
        }
        return this.stripe;
    }

    /**
     * Create a Payment Intent for Stripe card payments
     */
    async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
        const stripe = await this.getStripe();

        const paymentIntent = await stripe.paymentIntents.create({
            amount: input.amount, // Amount in smallest currency unit (VND = actual VND)
            currency: input.currency || 'vnd',
            metadata: {
                orderId: input.orderId,
                ...input.metadata,
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        if (!paymentIntent.client_secret) {
            throw new Error('Failed to create payment intent');
        }

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
        };
    }

    /**
     * Confirm payment was successful (called from webhook)
     */
    async confirmPayment(paymentIntentId: string): Promise<{
        success: boolean;
        orderId: string | null;
        amount: number;
    }> {
        const stripe = await this.getStripe();

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        return {
            success: paymentIntent.status === 'succeeded',
            orderId: paymentIntent.metadata.orderId || null,
            amount: paymentIntent.amount,
        };
    }

    /**
     * Get bank transfer information for manual payment
     */
    getBankTransferInfo(orderId: string, amount: number): BankTransferInfo {
        // Get bank info from environment or use defaults
        const bankName = process.env.BANK_NAME || 'MBBank';
        const accountNumber = process.env.BANK_ACCOUNT_NUMBER || '0123456789';
        const accountName = process.env.BANK_ACCOUNT_NAME || '3D PRINT SHOP';

        // Create unique transfer content for tracking
        const transferContent = `DH${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

        // Generate VietQR URL (using open VietQR API)
        const qrCodeUrl = this.generateVietQRUrl(bankName, accountNumber, amount, transferContent);

        return {
            orderId,
            amount,
            bankName,
            accountNumber,
            accountName,
            transferContent,
            qrCodeUrl,
        };
    }

    /**
     * Generate VietQR URL for bank transfer
     */
    private generateVietQRUrl(
        bankCode: string,
        accountNumber: string,
        amount: number,
        description: string
    ): string {
        // Map common bank names to VietQR bin codes
        const bankBins: Record<string, string> = {
            'mbbank': '970422',
            'vietcombank': '970436',
            'techcombank': '970407',
            'acb': '970416',
            'vpbank': '970432',
            'tpbank': '970423',
            'bidv': '970418',
            'agribank': '970405',
            'vietinbank': '970415',
            'sacombank': '970403',
        };

        const bin = bankBins[bankCode.toLowerCase()] || '970422'; // Default to MBBank
        const encodedDesc = encodeURIComponent(description);

        // VietQR compact format
        return `https://img.vietqr.io/image/${bin}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodedDesc}`;
    }

    /**
     * Verify Stripe webhook signature
     */
    async verifyWebhookSignature(
        payload: string | Buffer,
        signature: string
    ): Promise<import('stripe').default.Event> {
        const stripe = await this.getStripe();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
        }

        return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    }
}

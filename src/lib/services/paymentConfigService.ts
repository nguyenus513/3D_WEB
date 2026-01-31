/**
 * Payment Config Service
 * Fetches bank account configuration from payment_configs table
 * Fetches customer_code from profiles table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

// Order type mapping for payment_configs table
export type PaymentOrderType = 'ready_made' | 'custom' | 'printing';

export interface PaymentConfig {
    id: string;
    order_type: PaymentOrderType;
    bank_code: string;
    account_no: string;
    account_name: string;
    is_active: boolean;
    notes: string | null;
}

// Map product types to payment_configs order_type
export function getOrderTypeForProduct(productType: string): PaymentOrderType {
    switch (productType) {
        case 'product':
            return 'ready_made';
        case 'custom':
            return 'custom';
        case 'print':
        case 'printing':
            return 'printing';
        default:
            return 'ready_made';
    }
}

/**
 * Fetch active payment config for a specific order type
 */
export async function getPaymentConfig(orderType: PaymentOrderType): Promise<PaymentConfig | null> {
    const { data, error } = await supabaseAdmin
        .from('payment_configs')
        .select('*')
        .eq('order_type', orderType)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        console.error(`[PaymentConfig] Failed to fetch config for ${orderType}:`, error);
        return null;
    }

    return data as PaymentConfig;
}

/**
 * Get default fallback config if DB lookup fails
 * Returns null - callers must handle missing config
 * SECURITY: No hardcoded bank info in code
 */
export function getDefaultPaymentConfig(): PaymentConfig | null {
    console.warn('[PaymentConfig] DB config not found. Please ensure payment_configs table has active entries.');
    return null;
}

/**
 * Fetch customer_code from profiles table
 * Format: KH-XXXXXXXX or USR-XXXXXXXX
 * Supports email fallback for corrupted session IDs
 */
export async function getCustomerCode(userId: string, email?: string | null): Promise<string | null> {
    // First try by userId
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('customer_code')
        .eq('id', userId)
        .single();

    if (data?.customer_code) {
        return data.customer_code;
    }

    // Fallback to email lookup if userId not found
    if (email) {
        const { data: emailData } = await supabaseAdmin
            .from('profiles')
            .select('customer_code')
            .eq('email', email.toLowerCase())
            .single();

        if (emailData?.customer_code) {
            console.log('[PaymentConfig] Using email fallback for customer_code lookup');
            return emailData.customer_code;
        }
    }

    if (error) {
        console.error(`[PaymentConfig] Failed to fetch customer_code for user ${userId}:`, error);
    }
    return null;
}

/**
 * Generate fallback customer code from user ID if DB lookup fails
 * Format: USR-{first 8 chars of UUID}
 */
export function generateFallbackCustomerCode(userId: string): string {
    // Return first 10 hex chars of UUID
    return userId.replace(/-/g, '').substring(0, 10).toUpperCase();
}

/**
 * Generate transfer content
 * Format: {customer_code}-{order_code}
 * Example: KH-A1B2C3D4-7EABAC26B624
 */
export function generateTransferContent(customerCode: string, orderCode: string): string {
    return `${customerCode}${orderCode}`;
}

/**
 * Generate VietQR URL
 */
export function generateQRUrl(
    bankCode: string,
    accountNo: string,
    accountName: string,
    amount: number,
    transferContent: string
): string {
    const params = new URLSearchParams({
        amount: amount.toString(),
        addInfo: transferContent,
        accountName: accountName.toUpperCase(),
    });
    return `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact2.png?${params.toString()}`;
}

/**
 * Complete payment setup helper
 * Returns all info needed for QR generation
 */
export async function getPaymentSetup(
    userId: string,
    productType: string,
    orderCode: string,
    amount: number,
    email?: string | null  // Added for email fallback
): Promise<{
    customerCode: string;
    transferContent: string;
    qrUrl: string;
    bankInfo: PaymentConfig;
}> {
    // Get customer code from profiles (with email fallback)
    const customerCode = await getCustomerCode(userId, email) || generateFallbackCustomerCode(userId);

    // Get payment config from payment_configs table
    const orderType = getOrderTypeForProduct(productType);
    const bankInfo = await getPaymentConfig(orderType);

    // SECURITY: Fail if no config found - don't use hardcoded fallback
    if (!bankInfo) {
        throw new Error(`Payment config không tồn tại cho loại đơn hàng: ${orderType}. Vui lòng liên hệ admin.`);
    }

    // Generate transfer content: {customer_code}-{order_code}
    const transferContent = generateTransferContent(customerCode, orderCode);

    // Generate QR URL
    const qrUrl = generateQRUrl(
        bankInfo.bank_code,
        bankInfo.account_no,
        bankInfo.account_name,
        amount,
        transferContent
    );

    return {
        customerCode,
        transferContent,
        qrUrl,
        bankInfo,
    };
}


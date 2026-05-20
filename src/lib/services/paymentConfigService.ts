/**
 * Payment Config Service
 * MongoDB-backed payment configuration helpers.
 */

import { getMongoCollections } from '@/lib/mongodb';

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

interface PaymentConfigDocument {
    _id: string;
    order_type: PaymentOrderType;
    bank_code: string;
    account_no: string;
    account_name: string;
    is_active?: boolean | null;
    notes?: string | null;
}

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

function mapPaymentConfig(config: PaymentConfigDocument): PaymentConfig {
    return {
        id: config._id,
        order_type: config.order_type,
        bank_code: config.bank_code,
        account_no: config.account_no,
        account_name: config.account_name,
        is_active: config.is_active !== false,
        notes: config.notes || null,
    };
}

export async function getPaymentConfig(orderType: PaymentOrderType): Promise<PaymentConfig | null> {
    try {
        const { payment_configs } = await getMongoCollections() as unknown as {
            payment_configs: import('mongodb').Collection<PaymentConfigDocument>;
        };
        const data = await payment_configs.findOne({ order_type: orderType, is_active: { $ne: false } });
        return data ? mapPaymentConfig(data) : null;
    } catch (error) {
        console.error(`[PaymentConfig] Failed to fetch config for ${orderType}:`, error);
        return null;
    }
}

export function getDefaultPaymentConfig(): PaymentConfig | null {
    console.warn('[PaymentConfig] DB config not found. Please ensure payment_configs collection has active entries.');
    return null;
}

export async function getCustomerCode(userId: string, email?: string | null): Promise<string | null> {
    try {
        const { profiles } = await getMongoCollections();
        const byId = await profiles.findOne({ _id: userId }, { projection: { customer_code: 1 } });

        if (byId?.customer_code) {
            return byId.customer_code;
        }

        if (email) {
            const byEmail = await profiles.findOne(
                { email: email.toLowerCase() },
                { projection: { customer_code: 1 } }
            );

            if (byEmail?.customer_code) {
                console.log('[PaymentConfig] Using email fallback for customer_code lookup');
                return byEmail.customer_code;
            }
        }
    } catch (error) {
        console.error(`[PaymentConfig] Failed to fetch customer_code for user ${userId}:`, error);
    }

    return null;
}

export function generateFallbackCustomerCode(userId: string): string {
    return userId.replace(/-/g, '').substring(0, 10).toUpperCase();
}

export const VIETQR_MAX_TRANSFER_CONTENT_LENGTH = 25;

export function buildTransferContent(cartCode: string): string {
    if (cartCode.length > VIETQR_MAX_TRANSFER_CONTENT_LENGTH) {
        throw new Error(
            `Transfer content exceeds VietQR limit of ${VIETQR_MAX_TRANSFER_CONTENT_LENGTH} chars: ` +
            `"${cartCode}" (${cartCode.length} chars).`
        );
    }

    return cartCode;
}

export function generateTransferContent(cartCode: string): string {
    return buildTransferContent(cartCode);
}

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

export async function getPaymentSetup(
    userId: string,
    productType: string,
    orderCode: string,
    amount: number,
    email?: string | null,
    cartCode?: string
): Promise<{
    customerCode: string;
    transferContent: string;
    qrUrl: string;
    bankInfo: PaymentConfig;
}> {
    const customerCode = await getCustomerCode(userId, email) || generateFallbackCustomerCode(userId);
    const orderType = getOrderTypeForProduct(productType);
    const bankInfo = await getPaymentConfig(orderType);

    if (!bankInfo) {
        throw new Error(`Payment config không tồn tại cho loại đơn hàng: ${orderType}. Vui lòng liên hệ admin.`);
    }

    const transferContent = buildTransferContent(cartCode || orderCode.substring(0, 8).toUpperCase());
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

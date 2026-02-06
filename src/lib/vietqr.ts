/**
 * VietQR - Generate FREE QR codes for bank transfer
 * No API key required, 100% free
 * @see https://vietqr.io
 */

// Bank codes for VietQR
export const BANK_CODES = {
    VCB: 'VCB',         // Vietcombank
    TCB: 'TCB',         // Techcombank
    MB: 'MB',           // MB Bank
    VPB: 'VPB',         // VPBank
    ACB: 'ACB',         // ACB
    TPB: 'TPB',         // TPBank
    STB: 'STB',         // Sacombank
    HDB: 'HDB',         // HDBank
    VIB: 'VIB',         // VIB
    SHB: 'SHB',         // SHB
    EIB: 'EIB',         // Eximbank
    MSB: 'MSB',         // MSB
    OCB: 'OCB',         // OCB
    LPB: 'LPB',         // LienVietPostBank
    NAB: 'NAB',         // Nam A Bank
    BIDV: 'BIDV',       // BIDV
    CTG: 'CTG',         // Vietinbank
    AGR: 'AGR',         // Agribank
} as const;

export type BankCode = keyof typeof BANK_CODES;

interface VietQRConfig {
    bankId: BankCode;
    accountNo: string;
    accountName: string;
    template?: 'compact' | 'compact2' | 'qr_only' | 'print';
}

interface GenerateQRParams extends VietQRConfig {
    amount: number;
    addInfo: string; // Transfer content (order code)
}

/**
 * Generate VietQR image URL
 * @example
 * const qrUrl = generateVietQR({
 *   bankId: 'VCB',
 *   accountNo: '1234567890',
 *   accountName: 'NGUYEN VAN A',
 *   amount: 335000,
 *   addInfo: 'ORD-ABC123'
 * });
 */
export function generateVietQR({
    bankId,
    accountNo,
    accountName,
    amount,
    addInfo,
    template = 'compact2',
}: GenerateQRParams): string {
    const params = new URLSearchParams({
        amount: amount.toString(),
        addInfo: addInfo,
        accountName: accountName.toUpperCase(),
    });

    return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?${params.toString()}`;
}

/**
 * Generate bank transfer content with order code and customer code
 */
export function generateTransferContent(orderCode: string, customerCode?: string): string {
    // Format: "ORD-XXXX KH-YYYY"
    if (customerCode) {
        return `${orderCode} ${customerCode}`;
    }
    return orderCode;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(amount);
}

/**
 * Bank display info
 */
export const BANK_INFO: Record<BankCode, { name: string; shortName: string }> = {
    VCB: { name: 'Ngân hàng TMCP Ngoại Thương Việt Nam', shortName: 'Vietcombank' },
    TCB: { name: 'Ngân hàng TMCP Kỹ Thương Việt Nam', shortName: 'Techcombank' },
    MB: { name: 'Ngân hàng TMCP Quân Đội', shortName: 'MB Bank' },
    VPB: { name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank' },
    ACB: { name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB' },
    TPB: { name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank' },
    STB: { name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank' },
    HDB: { name: 'Ngân hàng TMCP Phát triển TP.HCM', shortName: 'HDBank' },
    VIB: { name: 'Ngân hàng TMCP Quốc tế Việt Nam', shortName: 'VIB' },
    SHB: { name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB' },
    EIB: { name: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam', shortName: 'Eximbank' },
    MSB: { name: 'Ngân hàng TMCP Hàng Hải', shortName: 'MSB' },
    OCB: { name: 'Ngân hàng TMCP Phương Đông', shortName: 'OCB' },
    LPB: { name: 'Ngân hàng TMCP Bưu Điện Liên Việt', shortName: 'LienVietPostBank' },
    NAB: { name: 'Ngân hàng TMCP Nam Á', shortName: 'Nam A Bank' },
    BIDV: { name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', shortName: 'BIDV' },
    CTG: { name: 'Ngân hàng TMCP Công Thương Việt Nam', shortName: 'Vietinbank' },
    AGR: { name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', shortName: 'Agribank' },
};

// Order type to determine which bank account to use
export type OrderType = 'ready_made' | 'custom' | 'printing';

/**
 * Get bank config from Supabase database
 * SECURITY: Bank account info stored securely in database with RLS
 */
import { getAdminSupabase } from './supabase/admin';

// Cache for bank configs (refreshed on demand)
const bankConfigCache: Map<OrderType, { config: VietQRConfig; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch bank config from database
 */
async function fetchBankConfigFromDB(orderType: OrderType): Promise<VietQRConfig | null> {
    try {
        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('payment_configs')
            .select('bank_code, account_no, account_name')
            .eq('order_type', orderType)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            console.error('[VietQR] Failed to fetch config from DB:', error);
            return null;
        }

        return {
            bankId: data.bank_code as BankCode,
            accountNo: data.account_no,
            accountName: data.account_name,
        };
    } catch (error) {
        console.error('[VietQR] Error fetching config:', error);
        return null;
    }
}

/**
 * Get bank config for order type with caching
 * Falls back to env vars if DB unavailable
 */
export async function getBankConfigForOrderTypeAsync(orderType: OrderType): Promise<VietQRConfig> {
    // Check cache first
    const cached = bankConfigCache.get(orderType);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.config;
    }

    // Try database first
    const dbConfig = await fetchBankConfigFromDB(orderType);
    if (dbConfig) {
        bankConfigCache.set(orderType, { config: dbConfig, timestamp: Date.now() });
        return dbConfig;
    }

    // Fallback to env vars (for backward compatibility)
    console.warn('[VietQR] DB unavailable, falling back to env vars');
    return getBankConfigFromEnv(orderType);
}

/**
 * Synchronous version - uses cache only, falls back to env
 * Use this for client components that can't await
 */
export function getBankConfigForOrderType(orderType: OrderType): VietQRConfig {
    // Check cache first
    const cached = bankConfigCache.get(orderType);
    if (cached) {
        return cached.config;
    }

    // Fall back to env vars
    return getBankConfigFromEnv(orderType);
}

/**
 * Get config from environment variables (fallback)
 */
function getBankConfigFromEnv(orderType: OrderType): VietQRConfig {
    const orderToBankMap: Record<OrderType, { bankId: BankCode; envNo: string; envName: string }> = {
        ready_made: { bankId: 'TCB', envNo: 'BANK_TCB_ACCOUNT_NO', envName: 'BANK_TCB_ACCOUNT_NAME' },
        custom: { bankId: 'TCB', envNo: 'BANK_TCB_ACCOUNT_NO', envName: 'BANK_TCB_ACCOUNT_NAME' },
        printing: { bankId: 'STB', envNo: 'BANK_STB_ACCOUNT_NO', envName: 'BANK_STB_ACCOUNT_NAME' },
    };

    const mapping = orderToBankMap[orderType];
    const accountNo = process.env[mapping.envNo];
    const accountName = process.env[mapping.envName];

    if (!accountNo || !accountName) {
        // Development fallback
        if (process.env.NODE_ENV === 'development') {
            return {
                bankId: mapping.bankId,
                accountNo: 'DEMO_ACCOUNT',
                accountName: 'DEMO_NAME',
            };
        }
        throw new Error(`Missing bank config for ${orderType}`);
    }

    return {
        bankId: mapping.bankId,
        accountNo,
        accountName,
    };
}

/**
 * Get bank config by order type
 * @deprecated Use getBankConfigForOrderTypeAsync for async or getBankConfigForOrderType for sync
 */
export function getBankConfig(orderType: OrderType): VietQRConfig {
    return getBankConfigForOrderType(orderType);
}

// Default fallback - use for ready_made
export function getDefaultBankConfig(): VietQRConfig {
    return getBankConfigForOrderType('ready_made');
}

// Pre-warm cache on server start (optional)
export async function preloadBankConfigs(): Promise<void> {
    const types: OrderType[] = ['ready_made', 'custom', 'printing'];
    await Promise.all(types.map(t => getBankConfigForOrderTypeAsync(t)));
}

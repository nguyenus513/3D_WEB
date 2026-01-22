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
 * Get bank config from environment variables
 * SECURITY: Bank account info should not be in source code
 * 
 * Required env vars:
 * - BANK_TCB_ACCOUNT_NO
 * - BANK_TCB_ACCOUNT_NAME
 * - BANK_STB_ACCOUNT_NO
 * - BANK_STB_ACCOUNT_NAME
 */
function getBankConfigFromEnv(bankId: BankCode): VietQRConfig {
    const configs: Record<string, { accountNoKey: string; accountNameKey: string }> = {
        TCB: { accountNoKey: 'BANK_TCB_ACCOUNT_NO', accountNameKey: 'BANK_TCB_ACCOUNT_NAME' },
        STB: { accountNoKey: 'BANK_STB_ACCOUNT_NO', accountNameKey: 'BANK_STB_ACCOUNT_NAME' },
    };

    const envConfig = configs[bankId];
    if (!envConfig) {
        throw new Error(`Bank config not found for ${bankId}`);
    }

    const accountNo = process.env[envConfig.accountNoKey];
    const accountName = process.env[envConfig.accountNameKey];

    if (!accountNo || !accountName) {
        console.warn(`[SECURITY] Missing bank env vars for ${bankId}. Using fallback.`);
        // Fallback for development only - should never happen in production
        if (process.env.NODE_ENV === 'development') {
            return {
                bankId,
                accountNo: 'DEMO_ACCOUNT',
                accountName: 'DEMO_NAME',
            };
        }
        throw new Error(`Missing bank configuration for ${bankId}`);
    }

    return {
        bankId,
        accountNo,
        accountName,
    };
}

// Bank configs by order type - lazy loaded from env
const bankConfigCache: Partial<Record<OrderType, VietQRConfig>> = {};

export function getBankConfigForOrderType(orderType: OrderType): VietQRConfig {
    // Check cache first
    if (bankConfigCache[orderType]) {
        return bankConfigCache[orderType]!;
    }

    // Map order types to bank IDs
    const orderToBankMap: Record<OrderType, BankCode> = {
        ready_made: 'TCB',
        custom: 'TCB',
        printing: 'STB',
    };

    const bankId = orderToBankMap[orderType];
    const config = getBankConfigFromEnv(bankId);

    // Cache for subsequent calls
    bankConfigCache[orderType] = config;

    return config;
}

/**
 * Get bank config by order type
 * @deprecated Use getBankConfigForOrderType instead
 */
export function getBankConfig(orderType: OrderType): VietQRConfig {
    return getBankConfigForOrderType(orderType);
}

// Default fallback - use for ready_made
export function getDefaultBankConfig(): VietQRConfig {
    return getBankConfigForOrderType('ready_made');
}


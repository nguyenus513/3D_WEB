/**
 * Local VietQR Generator
 * Generate QR codes directly on the client side using qrcode library
 * No external API calls - zero latency
 */

import QRCode from 'qrcode';
import { BANK_CODES, type BankCode, type OrderType } from './vietqr';

// Bank BIN codes for VietQR
const BANK_BINS: Record<BankCode, string> = {
    VCB: '970436',
    TCB: '970407',
    MB: '970422',
    VPB: '970432',
    ACB: '970416',
    TPB: '970423',
    STB: '970403',
    HDB: '970437',
    VIB: '970441',
    SHB: '970443',
    EIB: '970431',
    MSB: '970426',
    OCB: '970448',
    LPB: '970449',
    NAB: '970428',
    BIDV: '970418',
    CTG: '970415',
    AGR: '970405',
};

interface QRGeneratorParams {
    bankId: BankCode;
    accountNo: string;
    accountName: string;
    amount: number;
    addInfo: string; // Transfer content
}

/**
 * Generate VietQR EMV format string
 * Based on EMVCo QR Code Specification
 */
function generateEMVString(params: QRGeneratorParams): string {
    const { bankId, accountNo, amount, addInfo, accountName } = params;
    const bankBin = BANK_BINS[bankId];

    // Build merchant account info (Tag 38)
    const guid = '0010A000000727'; // VietQR GUID
    const beneficiaryOrg = `0006${bankBin}01${String(accountNo.length).padStart(2, '0')}${accountNo}`;
    const serviceCode = '0208QRIBFTTA';
    const merchantInfo = guid + beneficiaryOrg + serviceCode;
    const merchantInfoTag = `38${String(merchantInfo.length).padStart(2, '0')}${merchantInfo}`;

    // Build QR string
    let qrString = '';
    qrString += '000201'; // Payload Format Indicator
    qrString += '010212'; // Point of Initiation Method (dynamic)
    qrString += merchantInfoTag; // Merchant Account Info
    qrString += '5303704'; // Transaction Currency (VND)

    if (amount > 0) {
        const amountStr = amount.toString();
        qrString += `54${String(amountStr.length).padStart(2, '0')}${amountStr}`; // Amount
    }

    qrString += '5802VN'; // Country Code

    if (accountName) {
        const name = accountName.toUpperCase().substring(0, 25);
        qrString += `59${String(name.length).padStart(2, '0')}${name}`; // Merchant Name
    }

    qrString += '6006HANOI'; // Merchant City

    // Additional Data (Tag 62)
    if (addInfo) {
        const info = addInfo.substring(0, 25);
        const additionalData = `08${String(info.length).padStart(2, '0')}${info}`;
        qrString += `62${String(additionalData.length).padStart(2, '0')}${additionalData}`;
    }

    // Calculate CRC16
    qrString += '6304';
    const crc = calculateCRC16(qrString);
    qrString += crc;

    return qrString;
}

/**
 * CRC16-CCITT calculation
 */
function calculateCRC16(str: string): string {
    let crc = 0xFFFF;
    const polynomial = 0x1021;

    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ polynomial;
            } else {
                crc = crc << 1;
            }
        }
    }

    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generate QR code as data URL
 */
export async function generateLocalQR(params: QRGeneratorParams): Promise<string> {
    const emvString = generateEMVString(params);

    try {
        const dataUrl = await QRCode.toDataURL(emvString, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
            errorCorrectionLevel: 'M',
        });
        return dataUrl;
    } catch (error) {
        console.error('QR generation error:', error);
        throw error;
    }
}

/**
 * Alternative: Use VietQR image API (backup)
 */
export function getVietQRImageUrl(params: QRGeneratorParams): string {
    const { bankId, accountNo, accountName, amount, addInfo } = params;
    const queryParams = new URLSearchParams({
        amount: amount.toString(),
        addInfo: addInfo,
        accountName: accountName.toUpperCase(),
    });

    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?${queryParams.toString()}`;
}

// Re-export for convenience
export { BANK_CODES, type BankCode, type OrderType };

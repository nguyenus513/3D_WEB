import { PayOS } from '@payos/node';

function getPayOSEnv(name: string) {
  return process.env[name]
    ?.replace(/\\r|\\n/g, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

export function isPayOSConfigured() {
  return Boolean(getPayOSEnv('PAYOS_CLIENT_ID') && getPayOSEnv('PAYOS_API_KEY') && getPayOSEnv('PAYOS_CHECKSUM_KEY'));
}

export function getPayOS() {
  if (!isPayOSConfigured()) {
    throw new Error('PayOS is not configured');
  }

  return new PayOS({
    clientId: getPayOSEnv('PAYOS_CLIENT_ID')!,
    apiKey: getPayOSEnv('PAYOS_API_KEY')!,
    checksumKey: getPayOSEnv('PAYOS_CHECKSUM_KEY')!,
  });
}

export function getPayOSReturnUrl(orderId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5000';
  return `${baseUrl.replace(/\/$/, '')}/checkout/success/${orderId}`;
}

export function createPayOSOrderCode() {
  return Number(String(Date.now()).slice(-10));
}

export function getPayOSDescription(orderCode: string) {
  return `MINIVER ${orderCode}`.slice(0, 25);
}

export function getPayOSConfigStatus() {
  return {
    clientIdLength: getPayOSEnv('PAYOS_CLIENT_ID')?.length ?? 0,
    apiKeyLength: getPayOSEnv('PAYOS_API_KEY')?.length ?? 0,
    checksumKeyLength: getPayOSEnv('PAYOS_CHECKSUM_KEY')?.length ?? 0,
  };
}

/**
 * Google Drive OAuth Integration
 * Uses Admin's personal Google account (15GB free storage)
 * Tokens stored securely in Supabase
 * 
 * SECURITY:
 * - State parameter for CSRF protection
 * - Admin-only callback validation
 */

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { encryptTokenData, decryptTokenData } from '@/lib/security/token-encryption';

// Environment variables
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL + '/api/drive/callback';
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Supabase admin client (server-side only)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// OAuth2 client
function getOAuth2Client() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('Google OAuth credentials not configured');
    }

    return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/**
 * Generate and store OAuth state for CSRF protection
 */
export async function generateOAuthState(): Promise<string> {
    const state = randomBytes(32).toString('hex');

    // Store state temporarily (expires in 10 minutes)
    await supabaseAdmin
        .from('system_settings')
        .upsert({
            key: 'oauth_state_pending',
            value: { state, expires: Date.now() + 10 * 60 * 1000 },
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

    return state;
}

/**
 * Validate OAuth state parameter
 */
export async function validateOAuthState(state: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'oauth_state_pending')
        .single();

    if (!data?.value) return false;

    const { state: storedState, expires } = data.value as { state: string; expires: number };

    // Clean up used state
    await supabaseAdmin
        .from('system_settings')
        .delete()
        .eq('key', 'oauth_state_pending');

    if (Date.now() > expires) return false;
    return state === storedState;
}

/**
 * Generate OAuth authorization URL
 * NOTE: This is now async due to state generation
 */
export async function getAuthUrl(): Promise<string> {
    const oauth2Client = getOAuth2Client();
    const state = await generateOAuthState();

    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Get refresh token
        prompt: 'consent select_account', // Force consent AND account picker
        scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
        state,
    });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string) {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

/**
 * Save tokens to Supabase settings (encrypted)
 */
export async function saveTokens(tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
}) {
    // SECURITY: Encrypt tokens before storing
    const encryptedTokens = encryptTokenData(tokens);

    const tokenData = {
        access_token: encryptedTokens.access_token,
        refresh_token: encryptedTokens.refresh_token,
        expiry_date: tokens.expiry_date,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
        .from('system_settings')
        .upsert({
            key: 'google_drive_tokens',
            value: tokenData,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

    if (error) {
        console.error('Error saving tokens:', error);
        throw error;
    }

    return true;
}

/**
 * Get tokens from Supabase (decrypted)
 */
export async function getStoredTokens() {
    const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'google_drive_tokens')
        .single();

    if (error || !data) {
        return null;
    }

    const storedTokens = data.value as {
        access_token: string;
        refresh_token: string;
        expiry_date: number;
    };

    // SECURITY: Decrypt tokens after retrieving
    const decryptedTokens = decryptTokenData(storedTokens);

    return {
        access_token: decryptedTokens.access_token || '',
        refresh_token: decryptedTokens.refresh_token || '',
        expiry_date: storedTokens.expiry_date,
    };
}

/**
 * Get authenticated Drive client with auto-refresh
 */
/**
 * Get authenticated Drive client 
 * Priority:
 * 1. OAuth Token (from admin login) - ALWAYS preferred for personal Gmail
 * 2. Service Account - ONLY if explicitly requested (read-only operations)
 * 
 * Service Accounts have 0 storage quota on personal Gmail - they CANNOT upload files.
 * Only OAuth (user's own account) works for file uploads.
 */
export async function getDriveClient(options: { useServiceAccount?: boolean } = {}) {
    // 1. Try OAuth (User Account) FIRST — required for file uploads
    if (!options.useServiceAccount) {
        try {
            const tokens = await getStoredTokens();
            console.log('[DRIVE] Token check: found=', !!tokens, 'has_refresh=', !!tokens?.refresh_token, 'has_access=', !!tokens?.access_token);

            if (tokens && (tokens.refresh_token || tokens.access_token)) {
                const oauth2Client = getOAuth2Client();
                oauth2Client.setCredentials(tokens);

                // Check if token needs refresh
                if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
                    console.log('[DRIVE] Token expired, refreshing...');
                    try {
                        const { credentials } = await oauth2Client.refreshAccessToken();
                        await saveTokens({
                            access_token: credentials.access_token,
                            refresh_token: credentials.refresh_token || tokens.refresh_token,
                            expiry_date: credentials.expiry_date,
                        });
                        oauth2Client.setCredentials(credentials);
                        console.log('[DRIVE] ✓ Token refreshed successfully');
                    } catch (refreshError) {
                        console.error('[DRIVE] Token refresh failed:', refreshError);
                        throw new Error('Google Drive token expired and refresh failed. Please re-login as admin.');
                    }
                }

                console.log('[DRIVE] ✓ Using OAuth (personal account)');
                return google.drive({ version: 'v3', auth: oauth2Client });
            }
        } catch (tokenError) {
            console.error('[DRIVE] OAuth token retrieval error:', tokenError);
        }

        console.warn('[DRIVE] ⚠ No OAuth tokens in DB. Admin needs to re-login with Google.');
    }

    // 2. Service Account — ONLY if explicitly requested
    // WARNING: Service Accounts have 0 quota on personal Gmail. Cannot upload files.
    if (options.useServiceAccount) {
        const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY) {
            console.log('[DRIVE] Using Service Account (explicitly requested):', SERVICE_ACCOUNT_EMAIL);
            const auth = new google.auth.JWT({
                email: SERVICE_ACCOUNT_EMAIL,
                key: PRIVATE_KEY,
                scopes: ['https://www.googleapis.com/auth/drive'],
            });
            return google.drive({ version: 'v3', auth });
        }
    }

    throw new Error(
        'Google Drive not connected. Admin must login with Google to auto-save Drive tokens. ' +
        'Service Accounts cannot upload files to personal Gmail (0 quota).'
    );
}

/**
 * Check if Google Drive is connected
 */
export async function isDriveConnected(): Promise<boolean> {
    const status = await getDriveStatus();
    return status.connected;
}

export async function getDriveStatus(): Promise<{ connected: boolean; type?: 'service_account' | 'oauth' }> {
    // 1. Check OAuth Tokens FIRST (preferred for personal Gmail)
    const tokens = await getStoredTokens();
    if (tokens && (tokens.refresh_token || tokens.access_token)) {
        return { connected: true, type: 'oauth' };
    }

    // 2. Check Service Account (read-only, cannot upload to personal Gmail)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        return { connected: true, type: 'service_account' };
    }

    return { connected: false };
}

/**
 * Disconnect Google Drive
 */
export async function disconnectDrive() {
    const { error } = await supabaseAdmin
        .from('system_settings')
        .delete()
        .eq('key', 'google_drive_tokens');

    if (error) {
        throw error;
    }
    return true;
}

/**
 * Upload file to Google Drive using OAuth
 */
export async function uploadFileOAuth(
    file: Buffer,
    fileName: string,
    mimeType: string,
    folderId?: string
) {
    const drive = await getDriveClient();
    const targetFolder = folderId || FOLDER_ID;

    if (!targetFolder) {
        throw new Error('Target folder not specified');
    }

    // Upload file
    const response = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [targetFolder],
        },
        media: {
            mimeType,
            body: require('stream').Readable.from(file),
        },
        fields: 'id, name, webViewLink, webContentLink, thumbnailLink',
        supportsAllDrives: true,
    });

    // Make file publicly accessible
    await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    return {
        fileId: response.data.id!,
        fileName: response.data.name!,
        webViewLink: response.data.webViewLink!,
        webContentLink: response.data.webContentLink!,
        thumbnailLink: response.data.thumbnailLink ?? undefined,
    };
}

/**
 * Create or get existing subfolder in Drive
 */
export async function createOrGetSubfolder(
    parentFolderId: string,
    folderName: string
): Promise<string> {
    const drive = await getDriveClient();

    // Check if folder already exists
    const existing = await drive.files.list({
        q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    if (existing.data.files && existing.data.files.length > 0) {
        return existing.data.files[0].id!;
    }

    // Create new folder
    const response = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        },
        fields: 'id',
        supportsAllDrives: true,
    });

    return response.data.id!;
}

/**
 * Get direct URL for Drive file (for displaying images)
 * Uses lh3.googleusercontent.com which works better for img tags
 */
export function getDirectUrl(fileId: string): string {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
}

/**
 * Get thumbnail URL for Drive file
 * Uses lh3.googleusercontent.com with size parameter
 */
export function getThumbnailUrl(fileId: string, size: number = 400): string {
    return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
}

/**
 * Get download URL for Drive file
 */
export function getDownloadUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Build folder path recursively
 * Creates nested folders if they don't exist
 * 
 * @param pathSegments - Array of folder names, e.g. ['products', 'figures']
 * @returns Final folder ID
 * 
 * Examples:
 * - ['products', 'figures'] -> products/figures/
 * - ['customers', 'CUS-ABC', 'uploads', 'photos'] -> customers/CUS-ABC/uploads/photos/
 * - ['customers', 'CUS-ABC', 'orders', 'ORD-001', 'input'] -> customers/CUS-ABC/orders/ORD-001/input/
 */
export async function buildFolderPath(pathSegments: string[]): Promise<string> {
    if (!FOLDER_ID) {
        throw new Error('Root folder ID not configured');
    }

    let currentFolderId = FOLDER_ID;

    for (const segment of pathSegments) {
        currentFolderId = await createOrGetSubfolder(currentFolderId, segment);
    }

    return currentFolderId;
}

/**
 * Folder path builders
 * 
 * LEGACY paths (kept for backward compatibility):
 * - products/
 * - customers/{cusCode}/printing/{orderCode}/
 * - customers/{cusCode}/custom/{orderCode}/image-main/
 * 
 * STUDIO paths (new):
 * - ORD-{orderCode}/01_SOURCE/
 * - ORD-{orderCode}/02_DEMO/V01/
 * - ORD-{orderCode}/04_STL/
 * - ORD-{orderCode}/06_FINAL/
 */
export const FolderPaths = {
    // Products: products/ (flat folder — not order-based)
    product: () => ['products'],

    // LEGACY: Printing: customers/{cusCode}/printing/{orderCode}/
    printing: (customerCode: string, orderCode: string) =>
        ['customers', customerCode, 'printing', orderCode],

    // LEGACY: Custom
    customMain: (customerCode: string, orderCode: string) =>
        ['customers', customerCode, 'custom', orderCode, 'image-main'],
    customAccessory: (customerCode: string, orderCode: string) =>
        ['customers', customerCode, 'custom', orderCode, 'image-accessory'],
    customPreview: (customerCode: string, orderCode: string) =>
        ['customers', customerCode, 'custom', orderCode, 'preview'],

    // STUDIO: Order-Centric
    orderStudio: (orderCode: string) =>
        [`ORD-${orderCode}`],

    // STUDIO: Order + Stage
    orderStudioStage: (orderCode: string, stageFolder: string) =>
        [`ORD-${orderCode}`, stageFolder],

    // LEGACY: Order-Centric (kept for backward compat)
    orderCentric: (orderCode: string) =>
        ['orders', orderCode],
    orderCentricCategory: (orderCode: string, category: string) =>
        ['orders', orderCode, category],
};

/**
 * Upload with automatic folder path creation
 */
export async function uploadToPath(
    file: Buffer,
    fileName: string,
    mimeType: string,
    pathSegments: string[]
) {
    const folderId = await buildFolderPath(pathSegments);
    return uploadFileOAuth(file, fileName, mimeType, folderId);
}

/**
 * File naming conventions
 * STUDIO naming is preferred for new files.
 * Legacy naming kept for backward compatibility.
 */
export const FileNames = {
    // Legacy helpers
    product: (sku: string, index: number, ext: string) =>
        `${sku}_${String(index).padStart(2, '0')}.${ext}`,
    printing: (orderCode: string, index: number, ext: string) =>
        `${orderCode}_${String(index).padStart(2, '0')}.${ext}`,
    customMain: (orderCode: string, index: number, ext: string) =>
        `${orderCode}_main_${String(index).padStart(2, '0')}.${ext}`,
    customAccessory: (orderCode: string, index: number, ext: string) =>
        `${orderCode}_acc_${String(index).padStart(2, '0')}.${ext}`,
    customPreview: (orderCode: string, index: number, ext: string) =>
        `${orderCode}_preview_${String(index).padStart(2, '0')}.${ext}`,
    simple: (name: string) => name,
    getExt: (filename: string) => {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop()!.toLowerCase() : 'jpg';
    },
};

export async function uploadWithNaming(
    file: Buffer,
    originalFilename: string,
    mimeType: string,
    options: {
        type: 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview' | 'order_centric';
        sku?: string;
        customerCode?: string;
        orderCode?: string;
        category?: string; // For order_centric
        index: number;
    }
) {
    const ext = FileNames.getExt(originalFilename);
    let fileName: string;
    let pathSegments: string[];

    switch (options.type) {
        case 'product':
            fileName = FileNames.product(options.sku || 'PROD', options.index, ext);
            pathSegments = FolderPaths.product();
            break;
        case 'printing':
            fileName = FileNames.printing(options.orderCode || 'P3D', options.index, ext);
            pathSegments = FolderPaths.printing(options.customerCode || 'CUS', options.orderCode || 'P3D');
            break;
        case 'custom_main':
            fileName = FileNames.customMain(options.orderCode || 'CUS', options.index, ext);
            pathSegments = FolderPaths.customMain(options.customerCode || 'CUS', options.orderCode || 'CUS');
            break;
        case 'custom_accessory':
            fileName = FileNames.customAccessory(options.orderCode || 'CUS', options.index, ext);
            pathSegments = FolderPaths.customAccessory(options.customerCode || 'CUS', options.orderCode || 'CUS');
            break;
        case 'custom_preview':
            fileName = FileNames.customPreview(options.orderCode || 'CUS', options.index, ext);
            pathSegments = FolderPaths.customPreview(options.customerCode || 'CUS', options.orderCode || 'CUS');
            break;
        case 'order_centric':
            // Use original filename or constructed one
            fileName = originalFilename;
            if (options.category) {
                pathSegments = FolderPaths.orderCentricCategory(options.orderCode || 'UNKNOWN', options.category);
            } else {
                pathSegments = FolderPaths.orderCentric(options.orderCode || 'UNKNOWN');
            }
            break;
        default:
            throw new Error('Invalid upload type');
    }

    return uploadToPath(file, fileName, mimeType, pathSegments);
}

// Aliases for backward compatibility
export const uploadFile = uploadFileOAuth;
export const ensureFolder = createOrGetSubfolder;

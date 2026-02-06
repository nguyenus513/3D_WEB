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
        .from('settings')
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
        .from('settings')
        .select('value')
        .eq('key', 'oauth_state_pending')
        .single();

    if (!data?.value) return false;

    const { state: storedState, expires } = data.value as { state: string; expires: number };

    // Clean up used state
    await supabaseAdmin
        .from('settings')
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
        .from('settings')
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
        .from('settings')
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
 * 1. Service Account (if configured in env) - Recommended for server-side
 * 2. OAuth Token (if stored in DB) - Fallback for personal accounts
 */
export async function getDriveClient(options: { preferOAuth?: boolean } = {}) {
    // 1. If preferOAuth is true, check OAuth tokens first
    if (options.preferOAuth) {
        const tokens = await getStoredTokens();
        if (tokens && tokens.refresh_token) {
            const oauth2Client = getOAuth2Client();
            oauth2Client.setCredentials(tokens);

            // Check refresh
            if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
                try {
                    const { credentials } = await oauth2Client.refreshAccessToken();
                    await saveTokens({
                        access_token: credentials.access_token,
                        refresh_token: credentials.refresh_token || tokens.refresh_token,
                        expiry_date: credentials.expiry_date,
                    });
                    oauth2Client.setCredentials(credentials);
                } catch (error) {
                    console.warn('[DRIVE] Failed to refresh OAuth token:', error);
                    // Fall through to Service Account if OAuth fails? Or throw?
                    // If they PREFERRED OAuth, we should probably try SA as backup if configured.
                }
            }
            return google.drive({ version: 'v3', auth: oauth2Client });
        }
    }

    // 2. Try Service Account (Default Priority)
    const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY) {
        // console.log('[DRIVE] Using Service Account:', SERVICE_ACCOUNT_EMAIL);
        const auth = new google.auth.JWT({
            email: SERVICE_ACCOUNT_EMAIL,
            key: PRIVATE_KEY,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
        return google.drive({ version: 'v3', auth });
    }

    // 3. Fallback to OAuth (if not preferred but SA missing)
    if (!options.preferOAuth) {
        const tokens = await getStoredTokens();
        if (!tokens || !tokens.refresh_token) {
            throw new Error('Google Drive not connected. Please configure Service Account in .env or connect in Admin Settings.');
        }

        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokens);

        // Check if token needs refresh
        if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
            try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                await saveTokens({
                    access_token: credentials.access_token,
                    refresh_token: credentials.refresh_token || tokens.refresh_token,
                    expiry_date: credentials.expiry_date,
                });
                oauth2Client.setCredentials(credentials);
            } catch (error) {
                console.error('Failed to refresh token:', error);
                throw new Error('Google Drive OAuth token expired. Please reconnect in Admin Settings.');
            }
        }
        return google.drive({ version: 'v3', auth: oauth2Client });
    }

    throw new Error('No valid Google Drive authentication method found.');
}

/**
 * Check if Google Drive is connected
 */
export async function isDriveConnected(): Promise<boolean> {
    const status = await getDriveStatus();
    return status.connected;
}

export async function getDriveStatus(): Promise<{ connected: boolean; type?: 'service_account' | 'oauth' }> {
    // 1. Check Service Account
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        return { connected: true, type: 'service_account' };
    }

    // 2. Check OAuth Tokens
    const tokens = await getStoredTokens();
    if (tokens && tokens.refresh_token) {
        return { connected: true, type: 'oauth' };
    }

    return { connected: false };
}

/**
 * Disconnect Google Drive
 */
export async function disconnectDrive() {
    const { error } = await supabaseAdmin
        .from('settings')
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
    try {
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
    } catch (error: any) {
        // Check for Service Account Quota Error (403)
        // "Service Accounts do not have storage quota" or "The user's Drive storage quota has been exceeded"
        const msg = error?.message || '';
        const isQuotaError = (error.code === 403 || error.status === 403) &&
            (msg.includes('storage quota') || msg.includes('quota'));

        if (isQuotaError) {
            console.warn('[DRIVE] Service Account quota exceeded. Retrying with User OAuth...');

            // Retry with OAuth Priority
            const oauthDrive = await getDriveClient({ preferOAuth: true });

            const response = await oauthDrive.files.create({
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
            await oauthDrive.permissions.create({
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
        throw error;
    }
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
 * Structure:
 * - products/                                           # Flat
 * - customers/{cusCode}/printing/{orderCode}/           # Printing STL
 * - customers/{cusCode}/custom/{orderCode}/image-main/  # Custom main
 * - customers/{cusCode}/custom/{orderCode}/image-accessory/ # Custom accessory
 * - customers/{cusCode}/custom/{orderCode}/preview/     # Custom preview
 */
export const FolderPaths = {
    // Products: products/ (flat folder)
    product: () => ['products'],

    // Printing: customers/{cusCode}/printing/{orderCode}/
    printing: (customerCode: string, orderCode: string) =>
        ['customers', customerCode, 'printing', orderCode],

    // Custom: customers/{cusCode}/custom/{orderCode}/{type}/
    customMain: (customerCode: string, orderCode: string) =>
        ['customers', customerCode, 'custom', orderCode, 'image-main'],
    customAccessory: (customerCode: string, orderCode: string) =>
        ['customers', customerCode, 'custom', orderCode, 'image-accessory'],
    customPreview: (customerCode: string, orderCode: string) =>
        ['customers', customerCode, 'custom', orderCode, 'preview'],
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
 * File naming conventions - SIMPLIFIED
 * 
 * Formats:
 * - Product: {SKU}_{index}.jpg → FIG-001_01.jpg
 * - Printing: {P3D-orderCode}_{index}.stl → P3D-2024-001_01.stl
 * - Custom main: {CUS-orderCode}_main_{index}.jpg
 * - Custom accessory: {CUS-orderCode}_acc_{index}.jpg
 * - Custom preview: {CUS-orderCode}_preview_{index}.jpg
 */
export const FileNames = {
    // Product: SKU_01.jpg
    product: (sku: string, index: number, ext: string) =>
        `${sku}_${String(index).padStart(2, '0')}.${ext}`,

    // Printing: P3D-2024-001_01.stl
    printing: (orderCode: string, index: number, ext: string) =>
        `${orderCode}_${String(index).padStart(2, '0')}.${ext}`,

    // Custom main: CUS-2024-001_main_01.jpg
    customMain: (orderCode: string, index: number, ext: string) =>
        `${orderCode}_main_${String(index).padStart(2, '0')}.${ext}`,

    // Custom accessory: CUS-2024-001_acc_01.jpg
    customAccessory: (orderCode: string, index: number, ext: string) =>
        `${orderCode}_acc_${String(index).padStart(2, '0')}.${ext}`,

    // Custom preview: CUS-2024-001_preview_01.jpg
    customPreview: (orderCode: string, index: number, ext: string) =>
        `${orderCode}_preview_${String(index).padStart(2, '0')}.${ext}`,

    // Extract extension
    getExt: (filename: string) => {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop()!.toLowerCase() : 'jpg';
    },
};

/**
 * Upload with automatic naming and folder path
 * 
 * Types:
 * - product: products/{SKU_01.jpg}
 * - printing: customers/{cusCode}/printing/{orderCode}/{P3D_01.stl}
 * - custom_main: customers/{cusCode}/custom/{orderCode}/image-main/{CUS_main_01.jpg}
 * - custom_accessory: customers/{cusCode}/custom/{orderCode}/image-accessory/{CUS_acc_01.jpg}
 * - custom_preview: customers/{cusCode}/custom/{orderCode}/preview/{CUS_preview_01.jpg}
 */
export async function uploadWithNaming(
    file: Buffer,
    originalFilename: string,
    mimeType: string,
    options: {
        type: 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview';
        sku?: string;
        customerCode?: string;
        orderCode?: string;
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

        default:
            throw new Error('Invalid upload type');
    }

    return uploadToPath(file, fileName, mimeType, pathSegments);
}

// Aliases for backward compatibility
export const uploadFile = uploadFileOAuth;
export const ensureFolder = createOrGetSubfolder;

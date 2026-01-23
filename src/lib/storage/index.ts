/**
 * Storage Module Index
 * 
 * Exports for hybrid storage (R2 + Google Drive)
 */

// R2 Storage
export {
    isR2Configured,
    uploadToR2,
    getPresignedUploadUrl, // New export
    downloadFromR2,
    deleteFromR2,
    getR2SignedUrl,
    existsInR2,
    generateR2Key,
    getStorageDestination,
    isPermanentOnR2,
    extractR2KeyFromUrl,
    isR2Url,
    type UploadType,
} from './r2';

// Migration Service
export {
    migrateOrderToArchive,
    type MigrationResult,
} from './migrate-to-drive';

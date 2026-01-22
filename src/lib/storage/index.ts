/**
 * Storage Module Index
 * 
 * Exports for hybrid storage (R2 + Google Drive)
 */

// R2 Storage
export {
    isR2Configured,
    uploadToR2,
    downloadFromR2,
    deleteFromR2,
    getR2SignedUrl,
    existsInR2,
    generateR2Key,
    getStorageDestination,
    type FileCategory,
} from './r2';

// Migration Service
export {
    migrateOrderToArchive,
    extractR2Key,
    isR2Url,
    isDriveUrl,
} from './migrate-to-drive';

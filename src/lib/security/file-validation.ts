/**
 * File Validation Utilities
 * 
 * Validates files by checking magic bytes (file signatures)
 * Prevents malicious file uploads disguised with wrong extensions
 */

// Magic bytes signatures for common file types
const MAGIC_SIGNATURES: Record<string, number[][]> = {
    // Standard images
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    'image/bmp': [[0x42, 0x4D]],
    'image/svg+xml': [[0x3C, 0x73, 0x76, 0x67], [0x3C, 0x3F, 0x78, 0x6D, 0x6C]], // <svg or <?xml
    // TIFF (also base for many RAW formats)
    'image/tiff': [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]], // II*\0 (LE) or MM\0* (BE)
    // iOS HEIC/HEIF/AVIF - ftyp-based formats (validated separately)
    'image/heic': [],
    'image/heif': [],
    'image/avif': [],
    // RAW camera formats (many share TIFF structure; validated by extension + header)
    'image/x-canon-cr2': [[0x49, 0x49, 0x2A, 0x00]],   // TIFF LE + CR2 marker at offset 8
    'image/x-adobe-dng': [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]], // TIFF structure
    'image/x-nikon-nef': [],     // TIFF-based, validated by extension
    'image/x-sony-arw': [],      // TIFF-based, validated by extension
    'image/x-panasonic-rw2': [[0x49, 0x49, 0x55, 0x00]], // RW2 specific header
    'image/x-olympus-orf': [[0x49, 0x49, 0x52, 0x4F]],   // IIRO
    'image/x-fuji-raf': [[0x46, 0x55, 0x4A, 0x49, 0x46, 0x49, 0x4C, 0x4D]], // FUJIFILM

    // 3D files
    'model/stl': [[0x73, 0x6F, 0x6C, 0x69, 0x64]], // "solid" for ASCII STL
    'application/octet-stream': [], // Binary STL has no magic bytes

    // Documents
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

// Allowed MIME types by category
export const ALLOWED_MIME_TYPES = {
    image: [
        // Standard web formats
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'image/svg+xml',
        // iOS / modern formats
        'image/heic',
        'image/heif',
        'image/avif',
        // RAW camera formats
        'image/x-canon-cr2',
        'image/x-nikon-nef',
        'image/x-sony-arw',
        'image/x-adobe-dng',
        'image/x-panasonic-rw2',
        'image/x-olympus-orf',
        'image/x-fuji-raf',
    ],
    model: [
        'application/octet-stream', // STL binary
        'model/stl',
        'model/obj',
    ],
};

// RAW file extensions for isImage detection in UploadService
export const RAW_IMAGE_EXTENSIONS = new Set([
    'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2',
    'dng', 'rw2', 'orf', 'raf', 'pef', 'srw', 'x3f',
    'heic', 'heif', 'avif', 'tiff', 'tif', 'bmp',
]);

/**
 * Validate file by checking magic bytes
 * @param buffer - File buffer
 * @param declaredMimeType - MIME type declared by client
 * @returns true if file signature matches declared type
 */
export function validateFileMagicBytes(buffer: Buffer, declaredMimeType: string): boolean {
    if (!buffer || buffer.length < 8) {
        return false;
    }

    const signatures = MAGIC_SIGNATURES[declaredMimeType];

    // If no signatures defined, allow but log warning
    if (!signatures || signatures.length === 0) {
        // For STL/OBJ files, check by extension since they have no standard magic bytes
        return true;
    }

    // Check if any signature matches
    return signatures.some(signature => {
        for (let i = 0; i < signature.length; i++) {
            if (buffer[i] !== signature[i]) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Detect file type from magic bytes
 * @param buffer - File buffer
 * @returns Detected MIME type or null
 */
export function detectFileType(buffer: Buffer, fileName?: string): string | null {
    if (!buffer || buffer.length < 8) {
        return null;
    }

    // Check for HEIC/HEIF/AVIF (ftyp-based formats)
    // ftyp box starts at offset 4 with "ftyp" magic
    if (buffer.length >= 12) {
        const ftypMagic = buffer.slice(4, 8).toString('ascii');
        if (ftypMagic === 'ftyp') {
            const brand = buffer.slice(8, 12).toString('ascii');
            if (['heic', 'heix', 'mif1'].includes(brand)) return 'image/heic';
            if (brand === 'heif') return 'image/heif';
            if (['avif', 'avis'].includes(brand)) return 'image/avif';
        }
    }

    // Check for Fuji RAF (starts with "FUJIFILM")
    if (buffer.length >= 8) {
        const fujiHeader = buffer.slice(0, 8).toString('ascii');
        if (fujiHeader === 'FUJIFILM') return 'image/x-fuji-raf';
    }

    // Check for Olympus ORF (IIRO or IIRS)
    if (buffer.length >= 4) {
        const orfHeader = buffer.slice(0, 4).toString('ascii');
        if (orfHeader === 'IIRO' || orfHeader === 'IIRS') return 'image/x-olympus-orf';
    }

    // Check for Panasonic RW2
    if (buffer.length >= 4 && buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x55 && buffer[3] === 0x00) {
        return 'image/x-panasonic-rw2';
    }

    // Check TIFF-based formats (TIFF, CR2, NEF, ARW, DNG)
    if (buffer.length >= 12) {
        const isLE = buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00;
        const isBE = buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A;
        if (isLE || isBE) {
            // CR2: TIFF LE + CR marker at offset 8-9 (0x43 0x52 = 'CR')
            if (isLE && buffer.length >= 10 && buffer[8] === 0x43 && buffer[9] === 0x52) {
                return 'image/x-canon-cr2';
            }
            // Use filename extension to disambiguate other TIFF-based RAW formats
            const ext = fileName?.toLowerCase().split('.').pop();
            if (ext === 'nef' || ext === 'nrw') return 'image/x-nikon-nef';
            if (ext === 'arw' || ext === 'srf' || ext === 'sr2') return 'image/x-sony-arw';
            if (ext === 'dng') return 'image/x-adobe-dng';
            if (ext === 'pef') return 'image/tiff'; // Pentax uses plain TIFF
            // Default: plain TIFF
            return 'image/tiff';
        }
    }

    // Check each known signature (non-TIFF-based)
    for (const [mimeType, signatures] of Object.entries(MAGIC_SIGNATURES)) {
        if (signatures.length === 0) continue;
        // Skip TIFF-based entries (already handled above)
        if (['image/tiff', 'image/x-canon-cr2', 'image/x-adobe-dng', 'image/x-panasonic-rw2', 'image/x-olympus-orf', 'image/x-fuji-raf'].includes(mimeType)) continue;

        const matches = signatures.some(signature => {
            for (let i = 0; i < signature.length; i++) {
                if (buffer[i] !== signature[i]) return false;
            }
            return true;
        });

        if (matches) return mimeType;
    }

    // Check for ASCII STL (starts with "solid")
    const header = buffer.slice(0, 5).toString('ascii');
    if (header === 'solid') return 'model/stl';

    return null;
}

/**
 * Validate uploaded file comprehensively
 * @param file - File object
 * @param buffer - File buffer
 * @param allowedCategories - Which file categories to allow
 * @returns Validation result
 */
export function validateUploadedFile(
    file: File,
    buffer: Buffer,
    allowedCategories: ('image' | 'model')[] = ['image', 'model']
): { valid: boolean; error?: string; detectedType?: string; warning?: string } {
    // Check file size (max 100MB)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        return { valid: false, error: 'File quá lớn. Tối đa 100MB.' };
    }

    // Get allowed MIME types
    const allowedTypes = allowedCategories.flatMap(cat => ALLOWED_MIME_TYPES[cat]);

    // Check declared MIME type
    const declaredType = file.type || 'application/octet-stream';

    // Detect actual type from magic bytes (pass filename for RAW disambiguation)
    const detectedType = detectFileType(buffer, file.name);

    // For images, validate magic bytes match
    // Allow RAW formats where browser declares 'application/octet-stream'
    const isRawExt = RAW_IMAGE_EXTENSIONS.has((file.name.toLowerCase().split('.').pop()) || '');
    if (declaredType.startsWith('image/') || isRawExt) {
        if (!detectedType || (!detectedType.startsWith('image/') && !isRawExt)) {
            return {
                valid: false,
                error: 'File không phải là hình ảnh hợp lệ.',
                detectedType: detectedType || undefined
            };
        }
    }

    // For 3D models, check file extension since magic bytes are unreliable
    const ext = file.name.toLowerCase().split('.').pop();
    if (['stl', 'obj'].includes(ext || '')) {
        // STL-specific validation
        if (ext === 'stl') {
            const stlValidation = validateSTLFile(buffer, file.size);
            if (!stlValidation.valid) {
                return stlValidation;
            }
            return {
                valid: true,
                detectedType: 'model/stl',
                warning: stlValidation.warning
            };
        }
        return { valid: true, detectedType: `model/${ext}` };
    }

    // Check if type is in allowed list
    if (!allowedTypes.includes(declaredType) && !allowedTypes.includes(detectedType || '')) {
        return {
            valid: false,
            error: 'Loại file không được hỗ trợ.',
            detectedType: detectedType || undefined
        };
    }

    return { valid: true, detectedType: detectedType || declaredType };
}

// =====================================================
// Phase 5: Upload Hardening - STL Specific Validation
// =====================================================

// STL Processing Limits
export const STL_LIMITS = {
    MAX_TRIANGLES: 500000,          // Max triangles for instant processing
    MAX_SIZE_INSTANT: 20 * 1024 * 1024, // 20MB for instant pricing
    MAX_SIZE_UPLOAD: 100 * 1024 * 1024,  // 100MB max upload
    PROCESSING_TIMEOUT: 30000,       // 30 seconds timeout
};

/**
 * Validate STL file for processing safety
 */
export function validateSTLFile(buffer: Buffer, fileSize: number): {
    valid: boolean;
    error?: string;
    warning?: string;
    triangleCount?: number;
    isAscii?: boolean;
} {
    // Check if ASCII or Binary STL
    const header = buffer.slice(0, 5).toString('ascii');
    const isAscii = header === 'solid';

    let triangleCount = 0;

    if (isAscii) {
        // ASCII STL - count 'facet' occurrences
        const content = buffer.toString('ascii');
        const facetMatches = content.match(/facet normal/gi);
        triangleCount = facetMatches?.length || 0;
    } else {
        // Binary STL - triangle count is at bytes 80-84
        if (buffer.length >= 84) {
            triangleCount = buffer.readUInt32LE(80);
        }
    }

    // Check triangle count
    if (triangleCount > STL_LIMITS.MAX_TRIANGLES) {
        return {
            valid: false,
            error: `File STL quá phức tạp (${triangleCount.toLocaleString()} triangles). Tối đa ${STL_LIMITS.MAX_TRIANGLES.toLocaleString()} triangles cho xử lý tự động.`,
            triangleCount,
            isAscii,
        };
    }

    // Warning for large files
    let warning: string | undefined;
    if (fileSize > STL_LIMITS.MAX_SIZE_INSTANT) {
        warning = 'File lớn có thể mất thêm thời gian xử lý.';
    }

    return {
        valid: true,
        triangleCount,
        isAscii,
        warning,
    };
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
    // Remove path separators and null bytes
    let safe = filename
        .replace(/[/\\]/g, '_')
        .replace(/\0/g, '')
        .replace(/\.\./g, '_');

    // Limit length
    if (safe.length > 255) {
        const ext = safe.split('.').pop() || '';
        const name = safe.slice(0, 250 - ext.length);
        safe = `${name}.${ext}`;
    }

    return safe;
}

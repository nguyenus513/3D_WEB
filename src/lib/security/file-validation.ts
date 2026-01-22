/**
 * File Validation Utilities
 * 
 * Validates files by checking magic bytes (file signatures)
 * Prevents malicious file uploads disguised with wrong extensions
 */

// Magic bytes signatures for common file types
const MAGIC_SIGNATURES: Record<string, number[][]> = {
    // Images
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header, need additional check
    'image/bmp': [[0x42, 0x4D]],
    'image/svg+xml': [[0x3C, 0x73, 0x76, 0x67], [0x3C, 0x3F, 0x78, 0x6D, 0x6C]], // <svg or <?xml

    // 3D files
    'model/stl': [[0x73, 0x6F, 0x6C, 0x69, 0x64]], // "solid" for ASCII STL
    'application/octet-stream': [], // Binary STL has no magic bytes

    // Documents (if needed later)
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

// Allowed MIME types by category
export const ALLOWED_MIME_TYPES = {
    image: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
    ],
    model: [
        'application/octet-stream', // STL binary
        'model/stl',
        'model/obj',
    ],
};

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
export function detectFileType(buffer: Buffer): string | null {
    if (!buffer || buffer.length < 8) {
        return null;
    }

    // Check each known signature
    for (const [mimeType, signatures] of Object.entries(MAGIC_SIGNATURES)) {
        if (signatures.length === 0) continue;

        const matches = signatures.some(signature => {
            for (let i = 0; i < signature.length; i++) {
                if (buffer[i] !== signature[i]) {
                    return false;
                }
            }
            return true;
        });

        if (matches) {
            return mimeType;
        }
    }

    // Check for ASCII STL (starts with "solid")
    const header = buffer.slice(0, 5).toString('ascii');
    if (header === 'solid') {
        return 'model/stl';
    }

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

    // Detect actual type from magic bytes
    const detectedType = detectFileType(buffer);

    // For images, validate magic bytes match
    if (declaredType.startsWith('image/')) {
        if (!detectedType || !detectedType.startsWith('image/')) {
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

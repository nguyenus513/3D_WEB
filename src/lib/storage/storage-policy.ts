/**
 * Storage Policy Helper
 *
 * Cost-first routing:
 * - 3D model files (STL/OBJ/3MF) -> Google Drive
 * - Images -> R2
 */

const MODEL_EXTENSIONS = new Set(['stl', 'obj', '3mf']);
const MODEL_MIME_TYPES = new Set([
    'model/stl',
    'model/obj',
    'model/3mf',
    'application/vnd.ms-package.3dmanufacturing-3dmodel',
    'application/vnd.microsoft.3mf',
]);

function normalizeExtension(nameOrExt: string): string {
    const trimmed = nameOrExt.trim().toLowerCase();
    if (!trimmed) return '';
    if (trimmed.includes('.')) {
        return trimmed.split('.').pop() || '';
    }
    return trimmed;
}

export function isModelFile(nameOrExt: string, mimeType?: string): boolean {
    const ext = normalizeExtension(nameOrExt);
    if (MODEL_EXTENSIONS.has(ext)) return true;

    const normalizedMime = (mimeType || '').toLowerCase();
    if (!normalizedMime) return false;

    return MODEL_MIME_TYPES.has(normalizedMime);
}

export function getStorageDestination(
    fileName: string,
    mimeType?: string
): 'drive' | 'r2' {
    return isModelFile(fileName, mimeType) ? 'drive' : 'r2';
}

import {
    generateCustomR2Key,
    generatePrintingR2Key,
    generateReviewR2Key,
} from '@/lib/storage/r2';
import { generateProductKey } from '@/lib/storage/unified-keys';
import type { UploadRequestInput } from '@/validators/upload.schema';

export function resolveUploadKey(params: UploadRequestInput, fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const uploadCode = params.orderCode || `TMP${Date.now().toString(16).toUpperCase()}${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

    if ((params.type === 'product' || params.type === 'product-size') && params.sku) {
        return generateProductKey({
            sku: params.sku,
            index: params.index ?? 1,
            ext,
            variant: params.type === 'product-size' ? 'size' : undefined,
        });
    }

    if (!params.customerCode) {
        throw new Error('Missing customerCode for order uploads');
    }

    if (params.isReview) {
        return generateReviewR2Key(
            uploadCode,
            params.index ?? 1,
            ext
        );
    }

    if (params.type === 'printing') {
        return generatePrintingR2Key(
            uploadCode,
            params.tech || 'fdm',
            params.index ?? 1,
            params.infill ?? undefined,
            params.layerHeight ?? undefined,
            params.color ?? undefined,
            ext
        );
    }

    // Custom uploads (single/couple/group or legacy custom)
    const customType = (params.customType || (params.type === 'custom_couple' ? 'couple' : params.type === 'custom_group' ? 'group' : 'single')) as 'single' | 'couple' | 'group';
    return generateCustomR2Key(
        uploadCode,
        customType,
        params.personCount || (customType === 'couple' ? 2 : customType === 'group' ? 3 : 1),
        params.photoCategory || 'main',
        params.index ?? 1,
        ext
    );
}

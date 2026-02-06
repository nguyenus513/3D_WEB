/**
 * Upload API Route
 *
 * Delegates all logic to UploadController.
 *
 * @see DEVELOPMENT_GUIDE.md - Rule #1: Routes Only Route
 */

import { NextRequest } from 'next/server';
import { uploadController } from '@/controllers/UploadController';
import { requireCsrf } from '@/lib/security/csrf';

/**
 * POST /api/upload
 * Upload file to R2 (images) or Google Drive (3D models)
 */
export async function POST(request: NextRequest) {
    const csrf = await requireCsrf(request);
    if (!csrf.valid) {
        return csrf.error!;
    }

    return uploadController.upload(request);
}


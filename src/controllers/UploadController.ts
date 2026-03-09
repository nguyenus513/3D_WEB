/**
 * Upload Controller
 *
 * Request handling layer for file upload API.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { BaseController, UnauthorizedError, RateLimitError } from '@/lib/core/BaseController';
import { UploadService } from '@/services/UploadService';
import { UploadRequestSchema } from '@/validators/upload.schema';
import { checkUploadRateLimit } from '@/lib/security/rate-limit';

// =============================================================================
// Upload Controller
// =============================================================================

export class UploadController extends BaseController {
    private readonly uploadService: UploadService;

    constructor() {
        super();
        this.uploadService = new UploadService();
    }

    /**
     * POST /api/upload
     * Upload file to R2 or Google Drive
     */
    async upload(request: NextRequest) {
        return this.wrapHandler(async () => {
            // Require authentication
            const session = await auth();
            if (!session?.user) {
                throw new UnauthorizedError();
            }

            const userId = session.user.id || session.user.email || 'unknown';
            const userRole = (session.user as { role?: string }).role;
            const isAdmin = userRole === 'admin';

            // Rate limit check
            const rateLimit = await checkUploadRateLimit(userId, isAdmin);
            if (!rateLimit.allowed) {
                throw new RateLimitError('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
            }

            // Parse form data
            const formData = await request.formData();
            const file = formData.get('file') as File;

            if (!file) {
                throw new Error('No file provided');
            }

            // Build params object for logging
            const rawParams = {
                type: formData.get('type'),
                index: formData.get('index'),
                sku: formData.get('sku'),
                customerCode: formData.get('customerCode'),
                orderCode: formData.get('orderCode'),
                customType: formData.get('customType'),
                personCount: formData.get('personCount'),
                photoCategory: formData.get('photoCategory'),
                tech: formData.get('tech'),
                infill: formData.get('infill'),
                layerHeight: formData.get('layerHeight'),
                color: formData.get('color'),
                isReview: formData.get('isReview'),
            };

            // Parse and validate upload params with safeParse for better error handling
            const parseResult = UploadRequestSchema.safeParse(rawParams);

            if (!parseResult.success) {
                console.error('[Upload] Validation failed:', parseResult.error.issues);
                // Return validation errors to client for debugging
                throw new Error(`Validation failed: ${JSON.stringify(parseResult.error.issues)}`);
            }

            const params = parseResult.data;

            // Convert File to Buffer
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const result = await this.uploadService.uploadFile(
                file,
                buffer,
                params,
                userId,
                isAdmin
            );
            return this.handleSuccess(result);
        }, 'UploadController.upload');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const uploadController = new UploadController();

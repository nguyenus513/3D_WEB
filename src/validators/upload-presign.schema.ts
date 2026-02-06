/**
 * Upload Presign Validator Schema
 */

import { z } from 'zod';
import { UploadRequestSchema } from '@/validators/upload.schema';

export const PresignUploadSchema = z.object({
    fileName: z.string().min(1).max(255),
    contentType: z.string().min(1).max(100),
    size: z.number().int().positive().max(100 * 1024 * 1024),
    params: UploadRequestSchema,
});

export type PresignUploadInput = z.infer<typeof PresignUploadSchema>;

export const CompleteUploadSchema = z.object({
    key: z.string().min(1),
    fileName: z.string().min(1).max(255),
    contentType: z.string().min(1).max(100),
    size: z.number().int().positive().max(100 * 1024 * 1024),
    orderId: z.string().uuid().optional(),
    orderCode: z.string().optional(),
    isPublic: z.boolean().optional().default(false),
});

export type CompleteUploadInput = z.infer<typeof CompleteUploadSchema>;


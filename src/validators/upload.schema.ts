/**
 * Upload Validator Schemas
 *
 * Zod schemas for validating upload-related API inputs.
 */

import { z } from 'zod';

// =============================================================================
// Upload Type Enum - Extended to handle all possible types
// =============================================================================

export const UploadTypeSchema = z.enum([
    'product',
    'product-size',
    'printing',
    'custom_single',
    'custom_couple',
    'custom_group',
    // Legacy types that might still be sent
    'custom',
]);

export type UploadType = z.infer<typeof UploadTypeSchema>;

// =============================================================================
// Custom Type Enum
// =============================================================================

export const CustomTypeSchema = z.enum(['single', 'couple', 'group']);
export type CustomType = z.infer<typeof CustomTypeSchema>;

// =============================================================================
// Tech Enum (Printing Technology)
// =============================================================================

export const TechSchema = z.enum(['resin', 'fdm']);
export type Tech = z.infer<typeof TechSchema>;

// =============================================================================
// Photo Category Enum
// =============================================================================

export const PhotoCategorySchema = z.enum(['main', 'accessory', 'glasses', 'hat', 'model_image']);
export type PhotoCategory = z.infer<typeof PhotoCategorySchema>;

// =============================================================================
// FDM Color Enum
// =============================================================================

export const FdmColorSchema = z.enum(['white', 'black', 'transparent']);
export type FdmColor = z.infer<typeof FdmColorSchema>;

// =============================================================================
// Upload Request Schema - Flexible to handle all upload types
// =============================================================================

export const UploadRequestSchema = z.object({
    // Required - type of upload
    type: UploadTypeSchema,

    // Index - optional with default
    index: z.coerce.number().int().min(0).optional().default(1),

    // Product uploads - optional
    sku: z.string().max(50).nullish(),

    // Order uploads - optional
    customerCode: z.string().nullish(),
    orderCode: z.string().nullish(),

    // NEW: Order item uploads (cart/sub-order codes)
    cartCode: z.string().max(8).nullish(),    // 8-char hex cart code
    fullCode: z.string().max(17).nullish(),   // {cartCode}_{itemOrderCode}

    // Custom order naming - all optional/nullable for non-custom uploads
    customType: CustomTypeSchema.nullish(),
    personCount: z.preprocess(
        (val) => (val === null || val === '' || val === undefined) ? undefined : val,
        z.coerce.number().int().min(1).optional()
    ),
    photoCategory: z.preprocess(
        (val) => (val === null || val === '' || val === undefined) ? undefined : val,
        PhotoCategorySchema.optional()
    ),

    // Printing order naming - all optional and nullable
    tech: TechSchema.nullish(),
    infill: z.coerce.number().int().min(0).max(100).nullish(),
    layerHeight: z.string().nullish(),
    color: FdmColorSchema.nullish(),

    // Admin review - optional
    isReview: z.coerce.boolean().optional().default(false),
});

export type UploadRequestInput = z.infer<typeof UploadRequestSchema>;

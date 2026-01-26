/**
 * Upload Validator Schemas
 *
 * Zod schemas for validating upload-related API inputs.
 */

import { z } from 'zod';

// =============================================================================
// Upload Type Enum
// =============================================================================

export const UploadTypeSchema = z.enum([
    'product',
    'printing',
    'custom_single',
    'custom_couple',
    'custom_group',
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

export const PhotoCategorySchema = z.enum(['main', 'accessory']);
export type PhotoCategory = z.infer<typeof PhotoCategorySchema>;

// =============================================================================
// FDM Color Enum
// =============================================================================

export const FdmColorSchema = z.enum(['white', 'black', 'transparent']);
export type FdmColor = z.infer<typeof FdmColorSchema>;

// =============================================================================
// Upload Request Schema
// =============================================================================

export const UploadRequestSchema = z.object({
    // From FormData - validated in controller
    type: UploadTypeSchema,
    index: z.coerce.number().int().min(1).default(1),

    // Product uploads
    sku: z.string().max(20).optional(),

    // Order uploads
    customerCode: z.string().optional(),
    orderCode: z.string().optional(),

    // Custom order naming
    customType: CustomTypeSchema.optional(),
    personCount: z.coerce.number().int().min(1).default(1),
    photoCategory: PhotoCategorySchema.default('main'),

    // Printing order naming
    tech: TechSchema.optional(),
    infill: z.coerce.number().int().min(0).max(100).default(20),
    layerHeight: z.string().default('0.2'),
    color: FdmColorSchema.default('white'),

    // Admin review
    isReview: z.coerce.boolean().default(false),
});

export type UploadRequestInput = z.infer<typeof UploadRequestSchema>;

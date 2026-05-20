/**
 * Product Validator Schemas
 *
 * Zod schemas for validating product-related API inputs.
 */

import { z } from 'zod';

// =============================================================================
// Product Status & Type Enums
// =============================================================================

export const ProductStatus = z.enum(['draft', 'active', 'archived']);
export type ProductStatusType = z.infer<typeof ProductStatus>;

export const ProductType = z.enum(['ready_made', 'custom', 'print_on_demand']);
export type ProductTypeS = z.infer<typeof ProductType>;

const optionalCategoryId = z.preprocess(
    (value) => value === '' ? null : value,
    z.string().min(1).optional().nullable(),
);

// =============================================================================
// Image & Size Schemas
// =============================================================================

export const ProductImageSchema = z.object({
    url: z.string().min(1), // Can be relative path like /api/files/...
    is_main: z.boolean().optional().default(false),
});

/** @deprecated Use VariantInputSchema instead */
export const ProductSizeSchema = z.object({
    name: z.string().min(1),
    sku: z.string().optional(),
    price: z.coerce.number().int().min(0),
    stock: z.coerce.number().int().min(0).default(0),
    enabled: z.boolean().default(true),
    images: z.array(z.string()).optional().default([]),
    image_url: z.string().optional().nullable(),
});

export const VariantInputSchema = z.object({
    name: z.string().default(''),
    sku: z.string().optional().nullable(),
    price: z.coerce.number().int().min(0),
    stock: z.coerce.number().int().min(0).default(0),
    enabled: z.boolean().default(true),
    image_url: z.string().optional().nullable(),
    images: z.array(z.string()).optional().default([]),
});

// =============================================================================
// Create Product Schema
// =============================================================================

export const CreateProductSchema = z.object({
    name: z.string().min(1).max(150),
    sku: z.string().min(1).max(50),
    slug: z.string().max(150).optional(),
    category_id: optionalCategoryId,
    type: ProductType.default('ready_made'),
    status: ProductStatus.default('draft'),
    short_description: z.string().max(300).optional().nullable(),
    description: z.string().optional().nullable(),
    base_price: z.coerce.number().int().min(0),
    sale_price: z.coerce.number().int().min(0).optional().nullable(),
    cost_price: z.coerce.number().int().min(0).optional().nullable(),
    stock: z.coerce.number().int().min(0).default(0),
    images: z.array(ProductImageSchema).optional().default([]),
    /** @deprecated Use variants instead */
    sizes: z.array(ProductSizeSchema).optional().default([]),
    variants: z.array(VariantInputSchema).optional().default([]),
    tags: z.array(z.string()).optional().default([]),
    is_featured: z.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type ProductImageInput = z.infer<typeof ProductImageSchema>;
export type ProductSizeInput = z.infer<typeof ProductSizeSchema>;
export type VariantInput = z.infer<typeof VariantInputSchema>;

// =============================================================================
// Update Product Schema
// =============================================================================

export const UpdateProductSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(150).optional(),
    sku: z.string().min(1).max(50).optional(),
    slug: z.string().max(150).optional(),
    status: ProductStatus.optional(),
    is_active: z.boolean().optional(),
    base_price: z.coerce.number().int().min(0).optional(),
    sale_price: z.coerce.number().int().min(0).nullable().optional(),
    is_featured: z.boolean().optional(),
    images: z.array(ProductImageSchema).optional(),
    /** @deprecated Use variants instead */
    sizes: z.array(ProductSizeSchema).optional(),
    variants: z.array(VariantInputSchema).optional(),
    description: z.string().nullable().optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

// =============================================================================
// Query Params Schema
// =============================================================================

export const ProductQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1).catch(1),
    limit: z.coerce.number().int().min(1).max(100).default(20).catch(20),
    status: ProductStatus.optional().nullable(),
});

export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;

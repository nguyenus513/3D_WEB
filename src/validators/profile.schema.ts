/**
 * Profile Validator Schemas
 *
 * Zod schemas for validating profile-related API inputs.
 */

import { z } from 'zod';

// =============================================================================
// Profile Role Enum
// =============================================================================

export const ProfileRole = z.enum(['customer', 'admin']);
export type ProfileRoleType = z.infer<typeof ProfileRole>;

// =============================================================================
// Update Profile Schema
// =============================================================================

export const UpdateProfileSchema = z.object({
    name: z.string().min(1, 'Tên không được để trống').max(100),
    phone: z.string().max(15).optional().or(z.literal('')),
    instagram: z.string().max(100).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// =============================================================================
// Profile Response Schema (for type safety)
// =============================================================================

export const ProfileSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string().nullable(),
    phone: z.string().nullable(),
    customer_code: z.string().nullable(),
    role: ProfileRole,
    email_verified: z.boolean(),
    instagram: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

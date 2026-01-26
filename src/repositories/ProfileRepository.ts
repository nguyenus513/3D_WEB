/**
 * Profile Repository
 *
 * Data access layer for profiles table.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

export interface Profile {
    id: string;
    email: string;
    full_name?: string | null;
    phone?: string | null;
    customer_code?: string | null;
    role: 'customer' | 'admin';
    email_verified?: boolean;
    instagram?: string | null;
    created_at: string;
    updated_at?: string;
}

// =============================================================================
// Profile Repository
// =============================================================================

export class ProfileRepository {
    constructor(private readonly db: SupabaseClient) { }

    /**
     * Find profile by email
     */
    async findByEmail(email: string): Promise<Profile | null> {
        const { data, error } = await this.db
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as Profile;
    }

    /**
     * Find profile by ID
     */
    async findById(id: string): Promise<Profile | null> {
        const { data, error } = await this.db
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as Profile;
    }

    /**
     * Create a new profile
     */
    async create(data: {
        email: string;
        full_name?: string;
        phone?: string;
        instagram?: string;
    }): Promise<Profile> {
        // Generate customer code
        const { generateId } = await import('@/lib/generateId');
        const customerCode = generateId.user();

        const { data: profile, error } = await this.db
            .from('profiles')
            .insert({
                id: crypto.randomUUID(),
                email: data.email,
                full_name: data.full_name,
                phone: data.phone,
                instagram: data.instagram,
                customer_code: customerCode,
                email_verified: true,
                role: 'customer',
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return profile as Profile;
    }

    /**
     * Update an existing profile
     */
    async update(
        id: string,
        data: {
            full_name?: string;
            phone?: string;
            instagram?: string;
        }
    ): Promise<Profile> {
        const { data: profile, error } = await this.db
            .from('profiles')
            .update({
                ...data,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return profile as Profile;
    }
}

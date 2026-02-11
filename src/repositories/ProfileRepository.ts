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
    avatar_url?: string | null;
    is_verified?: boolean;
    role: 'customer' | 'admin';
    created_at: string;
    updated_at?: string | null;
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
            console.error('[ProfileRepository.findByEmail] DB Error:', error);
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
            console.error('[ProfileRepository.findById] DB Error:', error);
            throw error;
        }

        return data as Profile;
    }

    /**
     * Create a new profile
     */
    async create(data: {
        id?: string;
        email: string;
        full_name?: string;
        phone?: string;
    }): Promise<Profile> {
        // Generate customer code
        const { generateId } = await import('@/lib/generateId');
        const customerCode = generateId.user();

        // Use provided ID or generate fallback
        let newId = data.id;
        if (!newId) {
            try {
                newId = crypto.randomUUID();
            } catch (e) {
                console.warn('[ProfileRepository.create] crypto.randomUUID() failed, using fallback:', e);
                newId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            }
        }

        const { data: profile, error } = await this.db
            .from('profiles')
            .insert({
                id: newId,
                email: data.email,
                full_name: data.full_name || null,
                phone: data.phone || null,
                customer_code: customerCode,
                role: 'customer',
                is_verified: false,
            })
            .select()
            .single();

        if (error) {
            console.error('[ProfileRepository.create] DB Error:', error);
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
            avatar_url?: string;
        }
    ): Promise<Profile> {
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (data.full_name !== undefined) updateData.full_name = data.full_name;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;

        const { data: profile, error } = await this.db
            .from('profiles')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[ProfileRepository.update] DB Error:', error);
            throw error;
        }

        return profile as Profile;
    }
}

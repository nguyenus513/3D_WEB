/**
 * Profile Repository
 *
 * Data access layer for the users table.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    customer_code: string | null;
    role: 'customer' | 'admin';
    created_at: string;
    updated_at: string | null;
}

// Raw DB row from users table (uses 'name' not 'full_name')
interface UserRow {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    customer_code: string | null;
    role: string;
    created_at: string;
    updated_at: string | null;
}

// =============================================================================
// Constants
// =============================================================================

const PROFILE_SELECT_FIELDS =
    'id, email, name, phone, customer_code, role, created_at, updated_at';

/** Map DB row (name) → Profile interface (full_name) */
function toProfile(row: UserRow): Profile {
    return {
        id: row.id,
        email: row.email,
        full_name: row.name,
        phone: row.phone,
        customer_code: row.customer_code,
        role: row.role as 'customer' | 'admin',
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// =============================================================================
// Profile Repository
// =============================================================================

export class ProfileRepository {
    constructor(private readonly db: SupabaseClient) { }

    /**
     * Find a profile by email
     */
    async findByEmail(email: string): Promise<Profile | null> {
        const { data, error } = await this.db
            .from('users')
            .select(PROFILE_SELECT_FIELDS)
            .eq('email', email)
            .single();

        if (error?.code === 'PGRST116') return null;
        if (error) throw error;
        return toProfile(data as UserRow);
    }

    /**
     * Find a profile by ID
     */
    async findById(id: string): Promise<Profile | null> {
        const { data, error } = await this.db
            .from('users')
            .select(PROFILE_SELECT_FIELDS)
            .eq('id', id)
            .single();

        if (error?.code === 'PGRST116') return null;
        if (error) throw error;
        return toProfile(data as UserRow);
    }

    /**
     * Create a new profile
     */
    async create(input: {
        id: string;
        email: string;
        full_name?: string | null;
        phone?: string | null;
    }): Promise<Profile> {
        const customerCode =
            'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

        const { data, error } = await this.db
            .from('users')
            .insert({
                id: input.id,
                email: input.email,
                name: input.full_name ?? null,
                phone: input.phone ?? null,
                customer_code: customerCode,
                role: 'customer',
            })
            .select(PROFILE_SELECT_FIELDS)
            .single();

        if (error) throw error;
        return toProfile(data as UserRow);
    }

    /**
     * Update an existing profile
     */
    async update(
        id: string,
        input: {
            full_name?: string | null;
            phone?: string | null;
        }
    ): Promise<Profile> {
        // Map full_name → name for the DB
        const dbUpdate: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };
        if (input.full_name !== undefined) dbUpdate.name = input.full_name;
        if (input.phone !== undefined) dbUpdate.phone = input.phone;

        const { data, error } = await this.db
            .from('users')
            .update(dbUpdate)
            .eq('id', id)
            .select(PROFILE_SELECT_FIELDS)
            .single();

        if (error) throw error;
        return toProfile(data as UserRow);
    }
}

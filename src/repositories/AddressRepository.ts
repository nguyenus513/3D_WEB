/**
 * Address Repository
 *
 * Data access layer for addresses table.
 * Handles all database operations related to user shipping addresses.
 *
 * @see backend-dev-guidelines.md - Rule #6: Use Repository Pattern for Data Access
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

export interface Address {
    id: string;
    user_id: string;
    label: string;
    full_name: string;
    phone: string;
    address_line: string;
    ward?: string;
    district?: string;
    province: string;
    is_default: boolean;
    created_at: string;
}

export interface CreateAddressInput {
    label?: string;
    full_name: string;
    phone: string;
    address_line: string;
    ward?: string;
    district?: string;
    province: string;
    is_default?: boolean;
}

export interface UpdateAddressInput {
    label?: string;
    full_name?: string;
    phone?: string;
    address_line?: string;
    ward?: string;
    district?: string;
    province?: string;
    is_default?: boolean;
}

// =============================================================================
// Address Repository
// =============================================================================

export class AddressRepository {
    constructor(private readonly db: SupabaseClient) { }

    /**
     * Find all addresses for a user
     */
    async findByUserId(userId: string): Promise<Address[]> {
        const { data, error } = await this.db
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return (data as Address[]) || [];
    }

    /**
     * Find a single address by ID
     */
    async findById(addressId: string): Promise<Address | null> {
        const { data, error } = await this.db
            .from('user_addresses')
            .select('*')
            .eq('id', addressId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as Address;
    }

    /**
     * Find address by ID and user ID (for ownership verification)
     */
    async findByIdAndUserId(addressId: string, userId: string): Promise<Address | null> {
        const { data, error } = await this.db
            .from('user_addresses')
            .select('*')
            .eq('id', addressId)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as Address;
    }

    /**
     * Find user's default address
     */
    async findDefaultByUserId(userId: string): Promise<Address | null> {
        const { data, error } = await this.db
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .eq('is_default', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as Address;
    }

    /**
     * Create a new address
     */
    async create(userId: string, input: CreateAddressInput): Promise<Address> {
        // If setting as default, unset other defaults first
        if (input.is_default) {
            await this.unsetDefaultForUser(userId);
        }

        const { data, error } = await this.db
            .from('user_addresses')
            .insert({
                user_id: userId,
                label: input.label || 'Nhà',
                full_name: input.full_name,
                phone: input.phone,
                address_line: input.address_line,
                ward: input.ward,
                district: input.district,
                province: input.province,
                is_default: input.is_default || false,
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as Address;
    }

    /**
     * Update an address
     */
    async update(addressId: string, userId: string, input: UpdateAddressInput): Promise<Address> {
        // If setting as default, unset other defaults first
        if (input.is_default) {
            await this.unsetDefaultForUser(userId);
        }

        const { data, error } = await this.db
            .from('user_addresses')
            .update({
                ...input,
            })
            .eq('id', addressId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as Address;
    }

    /**
     * Delete an address
     */
    async delete(addressId: string, userId: string): Promise<boolean> {
        const { error } = await this.db
            .from('addresses')
            .delete()
            .eq('id', addressId)
            .eq('user_id', userId);

        if (error) {
            throw error;
        }

        return true;
    }

    /**
     * Set an address as default
     */
    async setDefault(addressId: string, userId: string): Promise<Address> {
        // Unset current default
        await this.unsetDefaultForUser(userId);

        // Set new default
        const { data, error } = await this.db
            .from('addresses')
            .update({ is_default: true })
            .eq('id', addressId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as Address;
    }

    /**
     * Unset all defaults for a user
     */
    private async unsetDefaultForUser(userId: string): Promise<void> {
        await this.db
            .from('addresses')
            .update({ is_default: false })
            .eq('user_id', userId)
            .eq('is_default', true);
    }

    /**
     * Count addresses for a user
     */
    async countByUserId(userId: string): Promise<number> {
        const { count, error } = await this.db
            .from('addresses')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) {
            throw error;
        }

        return count || 0;
    }
}

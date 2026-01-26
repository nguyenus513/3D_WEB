/**
 * Auth Repository
 *
 * Data access layer for auth-related tables.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface VerificationToken {
    identifier: string;
    token: string;
    expires: string;
}

export interface PasswordResetToken {
    user_id: string;
    token_hash: string;
    expires_at: string;
    created_at: string;
}

// =============================================================================
// Auth Repository
// =============================================================================

export class AuthRepository {
    constructor(private readonly db: SupabaseClient) { }

    /**
     * Create a new user profile
     */
    async createUser(data: {
        email: string;
        hashedPassword: string;
        name?: string;
        phone?: string;
        instagram?: string;
    }): Promise<{ id: string; customer_code: string }> {
        const userId = crypto.randomUUID();
        const customerCode = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

        const { data: user, error } = await this.db
            .from('profiles')
            .insert({
                id: userId,
                email: data.email,
                full_name: data.name,
                name: data.name,
                phone: data.phone,
                instagram_username: data.instagram,
                password: data.hashedPassword,
                customer_code: customerCode,
                role: 'customer',
                email_verified: false,
            })
            .select('id, customer_code')
            .single();

        if (error) throw error;
        return user;
    }

    /**
     * Check if email exists
     */
    async emailExists(email: string): Promise<boolean> {
        const { data } = await this.db
            .from('profiles')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();
        return !!data;
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
        const { data, error } = await this.db
            .from('profiles')
            .select('id, email')
            .eq('email', email.toLowerCase())
            .single();

        if (error?.code === 'PGRST116') return null;
        if (error) throw error;
        return data;
    }

    /**
     * Create address for user
     */
    async createAddress(userId: string, address: {
        recipient_name?: string;
        recipient_phone?: string;
        address_line?: string;
        ward?: string;
        district?: string;
        province: string;
    }): Promise<void> {
        await this.db.from('addresses').insert({
            user_id: userId,
            full_name: address.recipient_name,
            phone: address.recipient_phone,
            address_line: address.address_line,
            ward: address.ward,
            district: address.district,
            province: address.province,
            label: 'Mặc định',
            is_default: true,
        });
    }

    /**
     * Save OTP verification token
     */
    async saveVerificationToken(email: string, otp: string, expiresAt: Date): Promise<void> {
        const { error } = await this.db.from('verification_tokens').insert({
            identifier: email,
            token: otp,
            expires: expiresAt.toISOString(),
        });
        if (error) throw error;
    }

    /**
     * Verify OTP token
     */
    async verifyOtp(email: string, otp: string): Promise<boolean> {
        const { data, error } = await this.db
            .from('verification_tokens')
            .select('*')
            .eq('identifier', email)
            .eq('token', otp)
            .gt('expires', new Date().toISOString())
            .single();

        if (error || !data) return false;

        // Delete used token
        await this.db
            .from('verification_tokens')
            .delete()
            .eq('identifier', email)
            .eq('token', otp);

        return true;
    }

    /**
     * Mark email as verified
     */
    async markEmailVerified(email: string): Promise<void> {
        const { error } = await this.db
            .from('profiles')
            .update({ email_verified: true })
            .eq('email', email.toLowerCase());
        if (error) throw error;
    }

    /**
     * Save password reset token
     */
    async saveResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
        await this.db.from('password_reset_tokens').upsert({
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }

    /**
     * Verify reset token and get user
     */
    async verifyResetToken(tokenHash: string): Promise<string | null> {
        const { data, error } = await this.db
            .from('password_reset_tokens')
            .select('user_id')
            .eq('token_hash', tokenHash)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !data) return null;
        return data.user_id;
    }

    /**
     * Update user password
     */
    async updatePassword(userId: string, hashedPassword: string): Promise<void> {
        const { error } = await this.db
            .from('profiles')
            .update({ password: hashedPassword })
            .eq('id', userId);
        if (error) throw error;

        // Delete used reset token
        await this.db
            .from('password_reset_tokens')
            .delete()
            .eq('user_id', userId);
    }
}

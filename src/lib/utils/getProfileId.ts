/**
 * Smart Profile ID Lookup Utility
 * 
 * Handles corrupted session IDs by falling back to email lookup.
 * Use this in all APIs that need to query user-specific data.
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface SessionUser {
    id?: string;
    email?: string | null;
}

/**
 * Get the correct profile ID from session.
 * First tries by ID, then falls back to email lookup.
 * 
 * @param user - Session user object with id and optional email
 * @param supabase - Supabase client instance
 * @returns The correct profile ID or null if not found
 */
export async function getProfileId(
    user: SessionUser | undefined | null,
    supabase: SupabaseClient
): Promise<string | null> {
    if (!user?.id) return null;

    // First, try to find profile by session ID
    const { data: byId } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

    if (byId) {
        return byId.id;
    }

    // ID not found, try email fallback
    if (user.email) {
        const { data: byEmail } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', user.email.toLowerCase())
            .single();

    if (byEmail) {
            if (process.env.NODE_ENV !== 'production') {
                console.log('[getProfileId] Using email fallback for user:', user.email);
            }
            return byEmail.id;
        }
    }

    // Neither found
    if (process.env.NODE_ENV !== 'production') {
        console.warn('[getProfileId] Profile not found for session user:', user.id, user.email);
    }
    return null;
}

/**
 * Get profile ID or throw error if not found.
 * Use this when profile MUST exist for the operation to continue.
 */
export async function requireProfileId(
    user: SessionUser | undefined | null,
    supabase: SupabaseClient
): Promise<string> {
    const profileId = await getProfileId(user, supabase);
    if (!profileId) {
        throw new Error('Profile not found. Please logout and login again.');
    }
    return profileId;
}

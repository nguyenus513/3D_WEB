/**
 * Smart Profile ID Lookup Utility
 * 
 * Handles corrupted session IDs by falling back to email lookup.
 * Use this in all APIs that need to query user-specific data.
 */

import type { MongoSupabaseCompatClient as SupabaseClient } from '@/lib/mongodb/supabase-compat';

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
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

    if (byId) {
        return byId.id;
    }

    // ID not found, try email fallback
    if (user.email) {
        const { data: byEmail } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email.toLowerCase())
            .single();

        if (byEmail) {
            console.log('[getProfileId] Using email fallback for user:', user.email);
            return byEmail.id;
        }
    }

    // Neither found - auto-create profile if we have enough info
    if (user.email) {
        console.log('[getProfileId] Auto-creating profile for:', user.email);
        try {
            const { generateId } = await import('@/lib/generateId');
            const { data: newProfile, error } = await supabase
                .from('users')
                .insert({
                    id: user.id,
                    email: user.email.toLowerCase(),
                    name: user.email.split('@')[0]
                        .replace(/[._]/g, ' ')
                        .replace(/\d+/g, '')
                        .trim()
                        .split(' ')
                        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                        .join(' ') || 'Khách hàng',
                    customer_code: generateId.user(),
                    role: 'customer',
                })
                .select('id')
                .single();

            if (!error && newProfile) {
                console.log('[getProfileId] Auto-created profile:', newProfile.id);
                return newProfile.id;
            }
            console.error('[getProfileId] Auto-create failed:', error?.message);
        } catch (createError) {
            console.error('[getProfileId] Auto-create exception:', createError);
        }
    }

    console.warn('[getProfileId] Profile not found for session user:', user.id, user.email);
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


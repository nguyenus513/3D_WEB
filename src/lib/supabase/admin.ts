import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client using service role key
 * This client BYPASSES RLS - only use in server-side admin routes!
 * 
 * WARNING: Never expose this on client-side!
 */

let adminClient: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
    if (adminClient) return adminClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase admin credentials');
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return adminClient;
}

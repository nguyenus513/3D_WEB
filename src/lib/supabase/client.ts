import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// Singleton instance for client-side
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
    if (!supabaseInstance) {
        supabaseInstance = createClient();
    }
    return supabaseInstance;
}

// Export types
export type { User, Session } from '@supabase/supabase-js';

import { getMongoSupabaseCompatClient, MongoSupabaseCompatClient } from '@/lib/mongodb/supabase-compat';

let adminClient: MongoSupabaseCompatClient | null = null;

export function getAdminSupabase(): MongoSupabaseCompatClient {
    adminClient ??= getMongoSupabaseCompatClient();
    return adminClient;
}

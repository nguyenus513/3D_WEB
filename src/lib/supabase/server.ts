export async function createClient() {
    return {
        auth: {
            exchangeCodeForSession: async (_code: string) => ({ data: { user: null }, error: null }),
            getUser: async () => ({ data: { user: null }, error: null }),
            getSession: async () => ({ data: { session: null }, error: null }),
        },
    };
}

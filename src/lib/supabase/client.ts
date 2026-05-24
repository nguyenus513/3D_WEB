type RealtimeCallback = (payload: { new: Record<string, unknown> }) => void;

interface NoopChannel {
    on: (_event: string, _filter: Record<string, unknown>, _callback: RealtimeCallback) => NoopChannel;
    subscribe: () => NoopChannel;
}

const noopChannel: NoopChannel = {
    on: () => noopChannel,
    subscribe: () => noopChannel,
};

const mongoBrowserClient = {
    channel: (_name?: string) => noopChannel,
    removeChannel: (_channel: NoopChannel) => undefined,
};

export function createClient() {
    return mongoBrowserClient;
}

export function getSupabase() {
    return mongoBrowserClient;
}

export type User = { id: string; email?: string | null };
export type Session = { user: User };


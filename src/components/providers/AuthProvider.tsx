'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <SessionProvider
            refetchOnWindowFocus={true}
            refetchInterval={0}
        >
            {children}
        </SessionProvider>
    );
}

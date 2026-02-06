'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface CsrfContextType {
    token: string | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

const CsrfContext = createContext<CsrfContextType>({
    token: null,
    isLoading: true,
    refresh: async () => {},
});

interface CsrfProviderProps {
    children: ReactNode;
    initialToken?: string;
}

/**
 * CSRF Provider Component
 * 
 * Wrap your app with this to provide CSRF token to all components.
 * The token is fetched from a server endpoint and stored in context.
 */
export function CsrfProvider({ children, initialToken }: CsrfProviderProps) {
    const [token, setToken] = useState<string | null>(initialToken || null);
    const [isLoading, setIsLoading] = useState(!initialToken);

    const syncMetaToken = (value: string | null) => {
        if (typeof document === 'undefined') return;
        const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
        if (meta) {
            meta.content = value || '';
        } else {
            const newMeta = document.createElement('meta');
            newMeta.name = 'csrf-token';
            newMeta.content = value || '';
            document.head.appendChild(newMeta);
        }
    };

    const fetchToken = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/security/csrf', {
                method: 'GET',
                credentials: 'include',
            });
            
            if (response.ok) {
                const data = await response.json();
                setToken(data.token);
                syncMetaToken(data.token);
            }
        } catch (error) {
            console.error('Failed to fetch CSRF token:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!initialToken) {
            fetchToken();
        } else {
            syncMetaToken(initialToken);
        }
    }, [initialToken]);

    // Refresh token periodically (every 50 minutes, before 1-hour expiry)
    useEffect(() => {
        const interval = setInterval(fetchToken, 50 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <CsrfContext.Provider value={{ token, isLoading, refresh: fetchToken }}>
            {children}
        </CsrfContext.Provider>
    );
}

/**
 * Hook to get CSRF token
 */
export function useCsrf() {
    const context = useContext(CsrfContext);
    
    if (!context) {
        throw new Error('useCsrf must be used within a CsrfProvider');
    }
    
    return context;
}

/**
 * Hook to get fetch function with CSRF token
 * 
 * @example
 * const csrfFetch = useCsrfFetch();
 * await csrfFetch('/api/orders/create', { method: 'POST', body: JSON.stringify(data) });
 */
export function useCsrfFetch() {
    const { token } = useCsrf();
    
    return (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        
        if (token) {
            headers.set('x-csrf-token', token);
        }
        
        return fetch(input, {
            ...init,
            headers,
            credentials: 'include',
        });
    };
}

/**
 * Helper function to add CSRF token to fetch requests (non-hook version)
 * For use outside of React components
 */
export function addCsrfToRequest(headers: HeadersInit = {}): Headers {
    const csrfToken = typeof document !== 'undefined' 
        ? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
        : null;
    
    const newHeaders = new Headers(headers);
    
    if (csrfToken) {
        newHeaders.set('x-csrf-token', csrfToken);
    }
    
    return newHeaders;
}

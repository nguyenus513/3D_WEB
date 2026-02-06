import { useCallback, useEffect, useMemo, useState } from 'react';

export type UiLabelValue =
    | string
    | number
    | boolean
    | null
    | UiLabelValue[]
    | { [key: string]: UiLabelValue };

export type UiLabelsByScope = Record<string, Record<string, UiLabelValue>>;

interface UseUiLabelsOptions {
    enabled?: boolean;
}

interface UseUiLabelsResult {
    labels: UiLabelsByScope;
    t: <T = UiLabelValue>(key: string, fallback?: T) => T;
    formatLabel: (template: string, vars: Record<string, string | number>) => string;
    isLoading: boolean;
    error: string | null;
}

export function useUiLabels(scopes: string[], options: UseUiLabelsOptions = {}): UseUiLabelsResult {
    const [labels, setLabels] = useState<UiLabelsByScope>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const normalizedScopes = useMemo(() => scopes.filter(Boolean), [scopes]);
    const scopeKey = useMemo(() => normalizedScopes.join(','), [normalizedScopes]);
    const enabled = options.enabled ?? normalizedScopes.length > 0;

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false);
            return;
        }

        let active = true;
        const controller = new AbortController();

        const fetchLabels = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({ scopes: scopeKey });
                const response = await fetch(`/api/ui-labels?${params.toString()}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to load labels');
                }

                if (active) {
                    setLabels(data.labels || {});
                }
            } catch (err) {
                if (active && !(err instanceof DOMException && err.name === 'AbortError')) {
                    setError((err as Error).message);
                }
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        };

        fetchLabels();

        return () => {
            active = false;
            controller.abort();
        };
    }, [enabled, scopeKey]);

    const t = useCallback(<T = UiLabelValue,>(key: string, fallback?: T): T => {
        for (const scope of normalizedScopes) {
            const scopeLabels = labels[scope];
            if (scopeLabels && Object.prototype.hasOwnProperty.call(scopeLabels, key)) {
                return scopeLabels[key] as T;
            }
        }
        return fallback as T;
    }, [labels, normalizedScopes]);

    const formatLabel = useCallback((template: string, vars: Record<string, string | number>) => {
        if (!template) return '';
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            const value = vars[key];
            if (value === undefined || value === null) return match;
            return String(value);
        });
    }, []);

    return { labels, t, formatLabel, isLoading, error };
}

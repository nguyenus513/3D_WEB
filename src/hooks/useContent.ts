import { useCallback, useEffect, useState } from 'react';

export interface ContentPage {
    id: string;
    slug: string;
    title: string | null;
    meta: Record<string, unknown> | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface ContentBlock {
    id: string;
    page_id: string;
    block_key: string;
    block_type: string;
    sort_order: number;
    data: Record<string, unknown> | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

interface UseContentOptions {
    draft?: boolean;
}

interface UseContentResult {
    page: ContentPage | null;
    blocks: ContentBlock[];
    getBlock: (key: string) => ContentBlock | undefined;
    isLoading: boolean;
    error: string | null;
}

export function useContent(slug: string, options: UseContentOptions = {}): UseContentResult {
    const [page, setPage] = useState<ContentPage | null>(null);
    const [blocks, setBlocks] = useState<ContentBlock[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) {
            setIsLoading(false);
            return;
        }

        let active = true;
        const controller = new AbortController();

        const fetchContent = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({ slug });
                if (options.draft) params.set('draft', '1');

                const response = await fetch(`/api/content?${params.toString()}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to load content');
                }

                if (active) {
                    setPage(data.page || null);
                    setBlocks(data.blocks || []);
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

        fetchContent();

        return () => {
            active = false;
            controller.abort();
        };
    }, [slug, options.draft]);

    const getBlock = useCallback((key: string) => {
        return blocks.find((block) => block.block_key === key);
    }, [blocks]);

    return { page, blocks, getBlock, isLoading, error };
}

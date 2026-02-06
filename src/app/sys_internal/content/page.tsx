'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUiLabels } from '@/hooks/useUiLabels';

interface ContentPage {
    id: string;
    slug: string;
    title: string | null;
    is_active: boolean;
    meta: Record<string, unknown> | null;
}

interface ContentBlock {
    id: string;
    page_id: string;
    block_key: string;
    block_type: string;
    sort_order: number;
    data: Record<string, unknown> | null;
    is_active: boolean;
}

interface ContentLabels {
    title?: string;
    subtitle?: string;
    pagesTitle?: string;
    blocksTitle?: string;
    newPage?: string;
    newBlock?: string;
    fields?: {
        slug?: string;
        title?: string;
        active?: string;
        blockKey?: string;
        blockType?: string;
        sortOrder?: string;
        data?: string;
    };
    buttons?: {
        create?: string;
        save?: string;
        delete?: string;
        refresh?: string;
    };
    messages?: {
        selectPage?: string;
        jsonError?: string;
    };
}

interface BlockState extends ContentBlock {
    dataText: string;
    saving?: boolean;
    deleting?: boolean;
}

export default function AdminContentPage() {
    const { t } = useUiLabels(['admin.content', 'admin.common']);
    const labels = t<ContentLabels>('labels', {}) as ContentLabels;

    const [pages, setPages] = useState<ContentPage[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<string>('');
    const [blocks, setBlocks] = useState<BlockState[]>([]);
    const [loadingPages, setLoadingPages] = useState(true);
    const [loadingBlocks, setLoadingBlocks] = useState(false);
    const [error, setError] = useState('');

    const [newPage, setNewPage] = useState({ slug: '', title: '' });
    const [newBlock, setNewBlock] = useState({ block_key: '', block_type: '', sort_order: 0 });

    const selectedPage = useMemo(() => pages.find(p => p.id === selectedPageId), [pages, selectedPageId]);

    useEffect(() => {
        fetchPages();
    }, []);

    useEffect(() => {
        if (selectedPageId) {
            fetchBlocks(selectedPageId);
        } else {
            setBlocks([]);
        }
    }, [selectedPageId]);

    const fetchPages = async () => {
        setLoadingPages(true);
        setError('');
        try {
            const res = await fetch('/api/admin/content/pages');
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to load pages');
            }
            setPages(data.pages || []);
            if (!selectedPageId && data.pages?.length) {
                setSelectedPageId(data.pages[0].id);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingPages(false);
        }
    };

    const fetchBlocks = async (pageId: string) => {
        setLoadingBlocks(true);
        setError('');
        try {
            const res = await fetch(`/api/admin/content/blocks?page_id=${pageId}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to load blocks');
            }
            const nextBlocks = (data.blocks || []).map((block: ContentBlock) => ({
                ...block,
                dataText: JSON.stringify(block.data || {}, null, 2),
            }));
            setBlocks(nextBlocks);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingBlocks(false);
        }
    };

    const handleCreatePage = async () => {
        if (!newPage.slug) return;
        try {
            const res = await fetch('/api/admin/content/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: newPage.slug, title: newPage.title, meta: {} }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to create page');
            }
            setPages(prev => [data.page, ...prev]);
            setSelectedPageId(data.page.id);
            setNewPage({ slug: '', title: '' });
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleUpdatePage = async () => {
        if (!selectedPage) return;
        try {
            const res = await fetch(`/api/admin/content/pages/${selectedPage.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: selectedPage.slug,
                    title: selectedPage.title,
                    meta: selectedPage.meta || {},
                    is_active: selectedPage.is_active,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to update page');
            }
            setPages(prev => prev.map(p => (p.id === selectedPage.id ? data.page : p)));
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleCreateBlock = async () => {
        if (!selectedPageId || !newBlock.block_key || !newBlock.block_type) return;
        try {
            const res = await fetch('/api/admin/content/blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    page_id: selectedPageId,
                    block_key: newBlock.block_key,
                    block_type: newBlock.block_type,
                    sort_order: newBlock.sort_order || 0,
                    data: {},
                    is_active: true,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to create block');
            }
            setBlocks(prev => [...prev, { ...data.block, dataText: JSON.stringify(data.block.data || {}, null, 2) }]);
            setNewBlock({ block_key: '', block_type: '', sort_order: 0 });
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleSaveBlock = async (block: BlockState) => {
        let parsed: Record<string, unknown> = {};
        try {
            parsed = JSON.parse(block.dataText || '{}');
        } catch {
            setError(labels.messages?.jsonError || 'Invalid JSON');
            return;
        }

        setBlocks(prev => prev.map(b => (b.id === block.id ? { ...b, saving: true } : b)));
        try {
            const res = await fetch(`/api/admin/content/blocks/${block.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    block_key: block.block_key,
                    block_type: block.block_type,
                    sort_order: block.sort_order,
                    data: parsed,
                    is_active: block.is_active,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to save block');
            }
            setBlocks(prev => prev.map(b => (b.id === block.id ? { ...data.block, dataText: JSON.stringify(data.block.data || {}, null, 2) } : b)));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBlocks(prev => prev.map(b => (b.id === block.id ? { ...b, saving: false } : b)));
        }
    };

    const handleDeleteBlock = async (block: BlockState) => {
        setBlocks(prev => prev.map(b => (b.id === block.id ? { ...b, deleting: true } : b)));
        try {
            const res = await fetch(`/api/admin/content/blocks/${block.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to delete block');
            }
            setBlocks(prev => prev.filter(b => b.id !== block.id));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBlocks(prev => prev.map(b => (b.id === block.id ? { ...b, deleting: false } : b)));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{labels.title}</h1>
                    <p className="text-white/50 mt-1">{labels.subtitle}</p>
                </div>
                <button
                    onClick={fetchPages}
                    className="px-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white/70 hover:text-white"
                >
                    {labels.buttons?.refresh}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pages */}
                <div className="bg-[#1D1D1F] rounded-2xl p-4 border border-white/10">
                    <h2 className="text-white font-semibold mb-4">{labels.pagesTitle}</h2>
                    {loadingPages ? (
                        <div className="text-white/50">...</div>
                    ) : (
                        <div className="space-y-2">
                            {pages.map(page => (
                                <button
                                    key={page.id}
                                    onClick={() => setSelectedPageId(page.id)}
                                    className={`w-full text-left px-3 py-2 rounded-xl border ${selectedPageId === page.id
                                        ? 'border-cyan-500 bg-cyan-500/10 text-white'
                                        : 'border-white/10 text-white/70 hover:text-white'
                                        }`}
                                >
                                    <div className="text-sm font-medium">{page.slug}</div>
                                    <div className="text-xs text-white/40">{page.title}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 space-y-2">
                        <input
                            type="text"
                            placeholder={labels.fields?.slug}
                            value={newPage.slug}
                            onChange={(e) => setNewPage(prev => ({ ...prev, slug: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                        />
                        <input
                            type="text"
                            placeholder={labels.fields?.title}
                            value={newPage.title}
                            onChange={(e) => setNewPage(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                        />
                        <button
                            onClick={handleCreatePage}
                            className="w-full px-3 py-2 rounded-xl bg-white text-black text-sm font-medium"
                        >
                            {labels.newPage}
                        </button>
                    </div>
                </div>

                {/* Blocks */}
                <div className="lg:col-span-2 bg-[#1D1D1F] rounded-2xl p-4 border border-white/10">
                    <h2 className="text-white font-semibold mb-4">{labels.blocksTitle}</h2>

                    {!selectedPageId && (
                        <p className="text-white/50 text-sm">{labels.messages?.selectPage}</p>
                    )}

                    {selectedPage && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input
                                    type="text"
                                    value={selectedPage.slug}
                                    onChange={(e) => setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, slug: e.target.value } : p))}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                                    placeholder={labels.fields?.slug}
                                />
                                <input
                                    type="text"
                                    value={selectedPage.title || ''}
                                    onChange={(e) => setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, title: e.target.value } : p))}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                                    placeholder={labels.fields?.title}
                                />
                                <label className="flex items-center gap-2 text-sm text-white/70">
                                    <input
                                        type="checkbox"
                                        checked={selectedPage.is_active}
                                        onChange={(e) => setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, is_active: e.target.checked } : p))}
                                    />
                                    {labels.fields?.active}
                                </label>
                            </div>
                            <button
                                onClick={handleUpdatePage}
                                className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium"
                            >
                                {labels.buttons?.save}
                            </button>
                        </div>
                    )}

                    <div className="mt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input
                                type="text"
                                placeholder={labels.fields?.blockKey}
                                value={newBlock.block_key}
                                onChange={(e) => setNewBlock(prev => ({ ...prev, block_key: e.target.value }))}
                                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                            />
                            <input
                                type="text"
                                placeholder={labels.fields?.blockType}
                                value={newBlock.block_type}
                                onChange={(e) => setNewBlock(prev => ({ ...prev, block_type: e.target.value }))}
                                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                            />
                            <input
                                type="number"
                                placeholder={labels.fields?.sortOrder}
                                value={newBlock.sort_order}
                                onChange={(e) => setNewBlock(prev => ({ ...prev, sort_order: Number(e.target.value) }))}
                                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                            />
                        </div>
                        <button
                            onClick={handleCreateBlock}
                            className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm"
                            disabled={!selectedPageId}
                        >
                            {labels.newBlock}
                        </button>
                    </div>

                    {loadingBlocks ? (
                        <div className="text-white/50 mt-4">...</div>
                    ) : (
                        <div className="space-y-6 mt-6">
                            {blocks.map(block => (
                                <div key={block.id} className="border border-white/10 rounded-2xl p-4 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <input
                                            type="text"
                                            value={block.block_key}
                                            onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, block_key: e.target.value } : b))}
                                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                                        />
                                        <input
                                            type="text"
                                            value={block.block_type}
                                            onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, block_type: e.target.value } : b))}
                                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                                        />
                                        <input
                                            type="number"
                                            value={block.sort_order}
                                            onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, sort_order: Number(e.target.value) } : b))}
                                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                                        />
                                        <label className="flex items-center gap-2 text-sm text-white/70">
                                            <input
                                                type="checkbox"
                                                checked={block.is_active}
                                                onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, is_active: e.target.checked } : b))}
                                            />
                                            {labels.fields?.active}
                                        </label>
                                    </div>
                                    <textarea
                                        value={block.dataText}
                                        onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, dataText: e.target.value } : b))}
                                        rows={6}
                                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSaveBlock(block)}
                                            className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium"
                                            disabled={block.saving}
                                        >
                                            {labels.buttons?.save}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBlock(block)}
                                            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm"
                                            disabled={block.deleting}
                                        >
                                            {labels.buttons?.delete}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

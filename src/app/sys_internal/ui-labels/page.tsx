'use client';

import { useEffect, useState } from 'react';
import { useUiLabels } from '@/hooks/useUiLabels';

interface UiLabelRow {
    id: string;
    scope: string;
    key: string;
    value: unknown;
    description: string | null;
    is_active: boolean;
}

interface UiLabelState extends UiLabelRow {
    valueText: string;
    saving?: boolean;
    deleting?: boolean;
}

interface UiLabelsLabels {
    title?: string;
    subtitle?: string;
    filters?: {
        scope?: string;
        search?: string;
    };
    fields?: {
        scope?: string;
        key?: string;
        value?: string;
        description?: string;
        active?: string;
    };
    buttons?: {
        create?: string;
        save?: string;
        delete?: string;
        refresh?: string;
    };
    messages?: {
        jsonError?: string;
    };
}

export default function AdminUiLabelsPage() {
    const { t } = useUiLabels(['admin.ui_labels', 'admin.common']);
    const labels = t<UiLabelsLabels>('labels', {}) as UiLabelsLabels;

    const [scopeFilter, setScopeFilter] = useState('');
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState<UiLabelState[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [newLabel, setNewLabel] = useState({
        scope: '',
        key: '',
        valueText: '{}',
        description: '',
        is_active: true,
    });

    useEffect(() => {
        fetchLabels();
    }, [scopeFilter, search]);

    const fetchLabels = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (scopeFilter) params.set('scope', scopeFilter);
            if (search) params.set('search', search);
            const res = await fetch(`/api/admin/ui-labels?${params.toString()}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to load labels');
            }
            const mapped = (data.labels || []).map((row: UiLabelRow) => ({
                ...row,
                valueText: JSON.stringify(row.value ?? {}, null, 2),
            }));
            setRows(mapped);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const parseValue = (valueText: string) => {
        try {
            return JSON.parse(valueText || '{}');
        } catch {
            throw new Error(labels.messages?.jsonError || 'Invalid JSON');
        }
    };

    const handleSave = async (row: UiLabelState) => {
        setRows(prev => prev.map(r => (r.id === row.id ? { ...r, saving: true } : r)));
        try {
            const res = await fetch('/api/admin/ui-labels', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: row.id,
                    scope: row.scope,
                    key: row.key,
                    value: parseValue(row.valueText),
                    description: row.description,
                    is_active: row.is_active,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to save label');
            }
            setRows(prev => prev.map(r => (r.id === row.id ? { ...data.label, valueText: JSON.stringify(data.label.value ?? {}, null, 2) } : r)));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setRows(prev => prev.map(r => (r.id === row.id ? { ...r, saving: false } : r)));
        }
    };

    const handleDelete = async (row: UiLabelState) => {
        setRows(prev => prev.map(r => (r.id === row.id ? { ...r, deleting: true } : r)));
        try {
            const res = await fetch('/api/admin/ui-labels', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to delete label');
            }
            setRows(prev => prev.filter(r => r.id !== row.id));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setRows(prev => prev.map(r => (r.id === row.id ? { ...r, deleting: false } : r)));
        }
    };

    const handleCreate = async () => {
        try {
            const res = await fetch('/api/admin/ui-labels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: newLabel.scope,
                    key: newLabel.key,
                    value: parseValue(newLabel.valueText),
                    description: newLabel.description,
                    is_active: newLabel.is_active,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to create label');
            }
            setRows(prev => [{ ...data.label, valueText: JSON.stringify(data.label.value ?? {}, null, 2) }, ...prev]);
            setNewLabel({ scope: '', key: '', valueText: '{}', description: '', is_active: true });
        } catch (err) {
            setError((err as Error).message);
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
                    onClick={fetchLabels}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <input
                    type="text"
                    placeholder={labels.filters?.scope}
                    value={scopeFilter}
                    onChange={(e) => setScopeFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                />
                <input
                    type="text"
                    placeholder={labels.filters?.search}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                />
            </div>

            <div className="bg-[#1D1D1F] rounded-2xl p-4 border border-white/10 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                        type="text"
                        placeholder={labels.fields?.scope}
                        value={newLabel.scope}
                        onChange={(e) => setNewLabel(prev => ({ ...prev, scope: e.target.value }))}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                    />
                    <input
                        type="text"
                        placeholder={labels.fields?.key}
                        value={newLabel.key}
                        onChange={(e) => setNewLabel(prev => ({ ...prev, key: e.target.value }))}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                    />
                    <input
                        type="text"
                        placeholder={labels.fields?.description}
                        value={newLabel.description}
                        onChange={(e) => setNewLabel(prev => ({ ...prev, description: e.target.value }))}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                    />
                    <label className="flex items-center gap-2 text-sm text-white/70">
                        <input
                            type="checkbox"
                            checked={newLabel.is_active}
                            onChange={(e) => setNewLabel(prev => ({ ...prev, is_active: e.target.checked }))}
                        />
                        {labels.fields?.active}
                    </label>
                </div>
                <textarea
                    value={newLabel.valueText}
                    onChange={(e) => setNewLabel(prev => ({ ...prev, valueText: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono"
                />
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium"
                >
                    {labels.buttons?.create}
                </button>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-white/50">...</div>
                ) : (
                    rows.map(row => (
                        <div key={row.id} className="bg-[#1D1D1F] rounded-2xl p-4 border border-white/10 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <input
                                    type="text"
                                    value={row.scope}
                                    onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, scope: e.target.value } : r))}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                                />
                                <input
                                    type="text"
                                    value={row.key}
                                    onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, key: e.target.value } : r))}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                                />
                                <input
                                    type="text"
                                    value={row.description || ''}
                                    onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, description: e.target.value } : r))}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                                />
                                <label className="flex items-center gap-2 text-sm text-white/70">
                                    <input
                                        type="checkbox"
                                        checked={row.is_active}
                                        onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: e.target.checked } : r))}
                                    />
                                    {labels.fields?.active}
                                </label>
                            </div>
                            <textarea
                                value={row.valueText}
                                onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, valueText: e.target.value } : r))}
                                rows={4}
                                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSave(row)}
                                    className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium"
                                    disabled={row.saving}
                                >
                                    {labels.buttons?.save}
                                </button>
                                <button
                                    onClick={() => handleDelete(row)}
                                    className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm"
                                    disabled={row.deleting}
                                >
                                    {labels.buttons?.delete}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

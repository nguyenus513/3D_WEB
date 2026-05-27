'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Category {
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
}

export default function AdminCategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
    });
    const [editFormData, setEditFormData] = useState({
        name: '',
        description: '',
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/admin/categories');
            const data = await response.json();
            setCategories(data.categories || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSaving(true);
        try {
            const response = await fetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setFormData({ name: '', description: '' });
                fetchCategories();
            } else {
                const data = await response.json();
                alert(data.error || 'Không thể tạo danh mục');
            }
        } catch (error) {
            console.error('Error creating category:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editFormData.name.trim()) return;

        setSaving(true);
        try {
            const response = await fetch('/api/admin/categories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...editFormData }),
            });

            if (response.ok) {
                setEditingId(null);
                fetchCategories();
            } else {
                const data = await response.json();
                alert(data.error || 'Không thể cập nhật');
            }
        } catch (error) {
            console.error('Error updating category:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xóa danh mục "${name}" VND`)) return;

        try {
            const response = await fetch('/api/admin/categories', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (response.ok) {
                fetchCategories();
            } else {
                const data = await response.json();
                alert(data.error || 'Không thể xóa');
            }
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    const startEdit = (category: Category) => {
        setEditingId(category.id);
        setEditFormData({
            name: category.name,
            description: category.description || '',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Danh mục sản phẩm</h1>
                <p className="text-[var(--text-secondary)] mt-1">Quản lý các danh mục cho sản phẩm</p>
            </div>

            {/* Add Form */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
            >
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Thêm danh mục mới</h2>
                <form onSubmit={handleCreate} className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Tên danh mục *"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="flex-1 px-4 py-3 bg-[var(--material-glass)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-white/20"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Mô tả (tùy chọn)"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="flex-1 px-4 py-3 bg-[var(--material-glass)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-[var(--material-glass)] transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Đang thêm...' : 'Thêm'}
                    </button>
                </form>
            </motion.div>

            {/* Categories List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden"
            >
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                        <p className="text-[var(--text-secondary)]">Đang tải...</p>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-[var(--text-secondary)]">Chưa có danh mục nào</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--border-color)]">
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">STT</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Tên danh mục</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Mô tả</th>
                                <th className="text-right text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category, index) => (
                                <tr key={category.id} className="border-b border-[var(--border-color)] hover:bg-[var(--material-glass)]">
                                    <td className="px-5 py-4 text-[var(--text-secondary)]">{index + 1}</td>
                                    <td className="px-5 py-4">
                                        {editingId === category.id ? (
                                            <input
                                                type="text"
                                                value={editFormData.name}
                                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                                className="w-full px-3 py-2 bg-[var(--material-glass)] border border-white/20 rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-white/20"
                                            />
                                        ) : (
                                            <span className="text-[var(--text-primary)] font-medium">{category.name}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        {editingId === category.id ? (
                                            <input
                                                type="text"
                                                value={editFormData.description}
                                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                                className="w-full px-3 py-2 bg-[var(--material-glass)] border border-white/20 rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-white/20"
                                            />
                                        ) : (
                                            <span className="text-[var(--text-secondary)]">{category.description || '-'}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {editingId === category.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdate(category.id)}
                                                        disabled={saving}
                                                        className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-2 rounded-lg hover:bg-[var(--material-glass)] text-[var(--text-secondary)]"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(category)}
                                                        className="p-2 rounded-lg hover:bg-[var(--material-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(category.id, category.name)}
                                                        className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </motion.div>
        </div>
    );
}

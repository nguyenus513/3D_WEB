/**
 * useNotifications Hook
 *
 * Provides notifications state, realtime subscription, and actions.
 * Works for both admin and regular users.
 *
 * Features:
 * - Fetch notifications via API
 * - Realtime subscription via Supabase channel
 * - Unread count tracking
 * - Mark as read / mark all as read
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '@/lib/supabase/client';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string | null;
    type: string;
    is_read: boolean;
    ref_id: string | null;
    ref_type: string | null;
    created_at: string;
    read_at: string | null;
}

interface UseNotificationsOptions {
    /** API endpoint to fetch from */
    endpoint?: string;
    /** Auto-refresh interval in ms (0 to disable) */
    refreshInterval?: number;
}

interface UseNotificationsReturn {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    /** Mark a single notification as read */
    markAsRead: (id: string) => Promise<void>;
    /** Mark all notifications as read */
    markAllAsRead: () => Promise<void>;
    /** Refetch notifications */
    refresh: () => Promise<void>;
    /** Latest notification for toast display */
    latestNotification: Notification | null;
    /** Clear the latest notification toast */
    clearLatest: () => void;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
    const {
        endpoint = '/api/notifications',
        refreshInterval = 30000,
    } = options;

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [latestNotification, setLatestNotification] = useState<Notification | null>(null);
    const isFirstLoad = useRef(true);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch(endpoint, { cache: 'no-store' });
            if (!res.ok) return;

            const data = await res.json();

            if (data.notifications) {
                setNotifications(data.notifications);
            }

            if (typeof data.unread_count === 'number') {
                setUnreadCount(data.unread_count);
            }
        } catch (error) {
            console.error('[useNotifications] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    // Initial fetch
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Auto-refresh interval
    useEffect(() => {
        if (refreshInterval <= 0) return;

        const interval = setInterval(fetchNotifications, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchNotifications, refreshInterval]);

    // Supabase Realtime subscription
    useEffect(() => {
        const supabase = getSupabase();

        const channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                },
                (payload: { new: Record<string, unknown> }) => {
                    const newNotification = payload.new as unknown as Notification;

                    // Add to the top of the list
                    setNotifications(prev => [newNotification, ...prev]);
                    setUnreadCount(prev => prev + 1);

                    // Show toast only after initial load
                    if (!isFirstLoad.current) {
                        setLatestNotification(newNotification);

                        // Auto-clear toast after 5 seconds
                        setTimeout(() => {
                            setLatestNotification(prev =>
                                prev?.id === newNotification.id ? null : prev
                            );
                        }, 5000);
                    }
                }
            )
            .subscribe();

        // Mark first load complete after subscription is ready
        isFirstLoad.current = false;

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const markAsRead = useCallback(async (id: string) => {
        // Optimistic update
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
        } catch (error) {
            console.error('[useNotifications] Mark read error:', error);
            // Revert on failure
            fetchNotifications();
        }
    }, [fetchNotifications]);

    const markAllAsRead = useCallback(async () => {
        // Optimistic update
        setNotifications(prev =>
            prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);

        try {
            await fetch('/api/notifications/read-all', { method: 'PATCH' });
        } catch (error) {
            console.error('[useNotifications] Mark all read error:', error);
            fetchNotifications();
        }
    }, [fetchNotifications]);

    const clearLatest = useCallback(() => {
        setLatestNotification(null);
    }, []);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refresh: fetchNotifications,
        latestNotification,
        clearLatest,
    };
}

/**
 * Order Flow Configuration — Single Source of Truth
 *
 * Defines timeline steps, labels, icons, and transitions for each order type.
 * ALL UI components (admin stepper, user timeline, status labels) import from here.
 *
 * 🟢 Ready Made: 4 steps
 * 🔵 Custom Figurine: 8 steps (with revision loop at step 3)
 * 🟣 Print 3D: 5 steps
 */

import {
    Check,
    Clock,
    Package,
    Truck,
    PenTool,
    Image as ImageIcon,
    ThumbsUp,
    Star,
    Printer,
    type LucideIcon,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type OrderFlowType = 'ready_made' | 'custom' | 'printing';

export function normalizeOrderFlowType(orderType?: string | null): OrderFlowType {
    if (orderType === 'custom') return 'custom';
    if (orderType === 'printing' || orderType === 'print_3d') return 'printing';
    return 'ready_made';
}

export interface FlowStep {
    /** DB status value (e.g. 'confirmed', 'designing') */
    status: string;
    /** Admin-facing label (Vietnamese) */
    adminLabel: string;
    /** User-facing label (Vietnamese) — defaults to adminLabel if omitted */
    userLabel?: string;
    /** Lucide icon component */
    icon: LucideIcon;
    /** Statuses that map to this step (for resolving current position) */
    aliases?: string[];
    /** Description shown to user at this step */
    userDescription?: string;
}

// =============================================================================
// 🟢 Ready Made — 4 steps
// =============================================================================

export const READY_MADE_FLOW: FlowStep[] = [
    {
        status: 'confirmed',
        adminLabel: 'Xác nhận TT',
        userLabel: 'Xác nhận thanh toán',
        icon: Check,
        aliases: ['paid'],
        userDescription: 'Thanh toán thành công, đơn được tạo.',
    },
    {
        status: 'processing',
        adminLabel: 'Chuẩn bị hàng',
        userLabel: 'Đang chuẩn bị hàng',
        icon: Package,
        userDescription: 'Đóng gói và kiểm tra sản phẩm.',
    },
    {
        status: 'shipping',
        adminLabel: 'Giao hàng',
        userLabel: 'Đang giao hàng',
        icon: Truck,
        userDescription: 'Đơn hàng đang được vận chuyển.',
    },
    {
        status: 'delivered',
        adminLabel: 'Hoàn thành',
        userLabel: 'Hoàn thành',
        icon: Check,
        userDescription: 'Giao hàng thành công.',
    },
];

// =============================================================================
// 🔵 Custom Figurine — 8 steps
// =============================================================================

export const CUSTOM_FLOW: FlowStep[] = [
    {
        status: 'confirmed',
        adminLabel: 'Xác nhận TT',
        userLabel: 'Xác nhận thanh toán',
        icon: Check,
        aliases: ['paid'],
        userDescription: 'Đã thanh toán cọc, đơn bắt đầu xử lý.',
    },
    {
        status: 'designing',
        adminLabel: 'Thiết kế',
        userLabel: 'Bắt đầu thiết kế',
        icon: PenTool,
        aliases: ['revising'],
        userDescription: 'Chúng tôi đang dựng mẫu 3D cho bạn.',
    },
    {
        status: 'review',
        adminLabel: 'Chờ duyệt',
        userLabel: 'Đợi xác nhận Demo',
        icon: ImageIcon,
        userDescription: 'Vui lòng xem ảnh demo và xác nhận.',
    },
    {
        status: 'approved',
        adminLabel: 'Đã duyệt',
        userLabel: 'Đã xác nhận Demo',
        icon: ThumbsUp,
        userDescription: 'Bạn đã đồng ý với thiết kế. Không thể chỉnh sửa thêm.',
    },
    {
        status: 'producing',
        adminLabel: 'Sản xuất',
        userLabel: 'Đang hoàn thiện sản phẩm',
        icon: Package,
        userDescription: 'In 3D, sơn, gia công.',
    },
    {
        status: 'finished',
        adminLabel: 'Hoàn thiện',
        userLabel: 'Đã hoàn thiện – Chuẩn bị giao',
        icon: Star,
        userDescription: 'Sản phẩm đã hoàn thành.',
    },
    {
        status: 'shipping',
        adminLabel: 'Giao hàng',
        userLabel: 'Đang giao hàng',
        icon: Truck,
        userDescription: 'Đơn hàng đang được vận chuyển.',
    },
    {
        status: 'delivered',
        adminLabel: 'Hoàn thành',
        userLabel: 'Hoàn thành',
        icon: Check,
        userDescription: 'Giao hàng thành công.',
    },
];

// =============================================================================
// 🟣 Print 3D — 5 steps
// =============================================================================

export const PRINTING_FLOW: FlowStep[] = [
    {
        status: 'confirmed',
        adminLabel: 'Xác nhận TT',
        userLabel: 'Xác nhận thanh toán',
        icon: Check,
        aliases: ['paid'],
        userDescription: 'Đã nhận file 3D từ khách.',
    },
    {
        status: 'printing',
        adminLabel: 'Đang in',
        userLabel: 'Đang hoàn thiện đơn hàng',
        icon: Printer,
        userDescription: 'Đang in 3D.',
    },
    {
        status: 'finished',
        adminLabel: 'Hoàn thành',
        userLabel: 'Đã hoàn thành – Chuẩn bị giao',
        icon: Star,
        userDescription: 'Có thể xem ảnh sản phẩm đã in.',
    },
    {
        status: 'shipping',
        adminLabel: 'Giao hàng',
        userLabel: 'Đang giao hàng',
        icon: Truck,
        userDescription: 'Đơn hàng đang được vận chuyển.',
    },
    {
        status: 'delivered',
        adminLabel: 'Hoàn thành',
        userLabel: 'Hoàn thành',
        icon: Check,
        userDescription: 'Giao hàng thành công.',
    },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get flow configuration by order type
 */
export function getFlowByType(orderType: string): FlowStep[] {
    switch (normalizeOrderFlowType(orderType)) {
        case 'custom':
            return CUSTOM_FLOW;
        case 'printing':
            return PRINTING_FLOW;
        case 'ready_made':
        default:
            return READY_MADE_FLOW;
    }
}

/**
 * Find the step index for a given status within a flow.
 * Checks both primary status and aliases.
 * Returns -1 if status is before the flow starts (e.g. 'pending')
 */
export function getStepIndex(flow: FlowStep[], status: string): number {
    // Direct match
    const directIndex = flow.findIndex((s) => s.status === status);
    if (directIndex !== -1) return directIndex;

    // Check aliases
    for (let i = 0; i < flow.length; i++) {
        if (flow[i].aliases?.includes(status)) return i;
    }

    // Pre-flow statuses
    if (status === 'pending' || status === 'pending_confirmation') return -1;

    return -1;
}

/**
 * Get the list of next valid statuses from a given status.
 * Used by admin to determine which buttons to show.
 */
export function getNextStatuses(orderType: string, currentStatus: string): string[] {
    const flow = getFlowByType(orderType);
    const idx = getStepIndex(flow, currentStatus);

    // If before flow, first step is next
    if (idx === -1) return flow.length > 0 ? [flow[0].status] : [];

    // Return all statuses after current
    return flow.slice(idx + 1).map((s) => s.status);
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(orderType: string, from: string, to: string): boolean {
    const nextStatuses = getNextStatuses(orderType, from);
    return nextStatuses.includes(to);
}

/**
 * Get user-facing label for a status within a specific order type
 */
export function getStatusLabel(orderType: string, status: string): string {
    const flow = getFlowByType(orderType);
    const step = flow.find(
        (s) => s.status === status || s.aliases?.includes(status)
    );
    return step?.userLabel || step?.adminLabel || status;
}

/**
 * Get admin-facing label for a status within a specific order type
 */
export function getAdminStatusLabel(orderType: string, status: string): string {
    const flow = getFlowByType(orderType);
    const step = flow.find(
        (s) => s.status === status || s.aliases?.includes(status)
    );
    return step?.adminLabel || status;
}

/**
 * Build user-facing timeline data from order type and status.
 *
 * Returns an array of objects: { status, label, description, completed, isCurrent, date }
 */
export function buildUserTimeline(
    orderType: string,
    currentStatus: string,
    options?: {
        createdAt?: string;
        deliveredAt?: string;
        shippedAt?: string;
        revisionCount?: number;
        formatDate?: (date: string) => string;
    }
): {
    status: string;
    label: string;
    description: string;
    completed: boolean;
    isCurrent: boolean;
    date: string;
}[] {
    const flow = getFlowByType(orderType);
    const currentIdx = getStepIndex(flow, currentStatus);
    const fmt = options?.formatDate || ((d: string) => d);

    return flow.map((step, idx) => {
        const isCurrent = idx === currentIdx;
        const completed = idx <= currentIdx;

        // Build context-aware date string
        let date = '';
        if (idx === 0 && completed && options?.createdAt) {
            date = fmt(options.createdAt);
        }
        if (step.status === 'review' && isCurrent) {
            date = 'Chờ bạn duyệt';
        }
        if (step.status === 'designing' && currentStatus === 'revising' && isCurrent) {
            date = `Chỉnh sửa lần ${options?.revisionCount || 1}`;
        }
        if (step.status === 'shipping' && isCurrent && options?.shippedAt) {
            date = fmt(options.shippedAt);
        }
        if (step.status === 'delivered' && currentStatus === 'shipping') {
            date = 'Đang giao';
        }
        if (step.status === 'delivered' && currentStatus === 'delivered' && options?.deliveredAt) {
            date = fmt(options.deliveredAt);
        }
        if ((step.status === 'producing' || step.status === 'printing') && isCurrent) {
            date = 'Đang thực hiện';
        }
        if (step.status === 'finished' && isCurrent) {
            date = 'Chờ giao hàng';
        }

        return {
            status: step.status,
            label: step.userLabel || step.adminLabel,
            description: step.userDescription || '',
            completed,
            isCurrent,
            date,
        };
    });
}

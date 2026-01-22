'use client';

import { OrderList } from '@/components/admin/OrderList';

export default function AdminOrdersPage() {
    return <OrderList orderType="all" title="Tất cả đơn hàng" />;
}

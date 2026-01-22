'use client';

import { OrderList } from '@/components/admin/OrderList';

export default function AdminCustomOrdersPage() {
    return <OrderList orderType="custom" title="Đơn hàng Custom" subtitle="Các đơn hàng đặt làm mô hình custom" />;
}

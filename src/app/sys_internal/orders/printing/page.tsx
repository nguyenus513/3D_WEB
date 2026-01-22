'use client';

import { OrderList } from '@/components/admin/OrderList';

export default function AdminPrintingOrdersPage() {
    return <OrderList orderType="printing" title="Đơn hàng In 3D" subtitle="Các đơn hàng dịch vụ in 3D" />;
}

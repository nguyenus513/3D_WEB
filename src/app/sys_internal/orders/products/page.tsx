'use client';

import { OrderList } from '@/components/admin/OrderList';

export default function AdminProductOrdersPage() {
    return <OrderList orderType="ready_made" title="Đơn hàng sản phẩm" subtitle="Các đơn hàng mua sản phẩm có sẵn" />;
}

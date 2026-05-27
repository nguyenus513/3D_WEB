import { getAdminSupabase } from '@/lib/supabase/admin';

function getNestedString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

type OrderStockAction = 'confirm' | 'release' | 'restore';

async function resolveVariantId(supabase: ReturnType<typeof getAdminSupabase>, item: any): Promise<string | null> {
  const direct = getNestedString(item.spec, 'variant_id') || getNestedString(item.configuration, 'variant_id');
  if (direct) return direct;
  if (!item.product_id) return null;

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, name, sku, is_active, sort_order')
    .eq('product_id', item.product_id)
    .order('sort_order', { ascending: true });

  const list = (variants || []).filter((variant: any) => variant.is_active !== false);
  if (list.length === 0) return null;

  const candidates = [
    item.sku,
    getNestedString(item.spec, 'sku'),
    getNestedString(item.configuration, 'sku'),
    getNestedString(item.spec, 'size'),
    getNestedString(item.configuration, 'size'),
    item.size,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const value of candidates) {
    const lower = value.toLowerCase();
    const match = list.find((variant: any) =>
      String(variant.id || '').toLowerCase() === lower ||
      String(variant.sku || '').toLowerCase() === lower ||
      String(variant.name || '').toLowerCase() === lower
    );
    if (match?.id) return match.id;
  }

  if (candidates.some((value) => value.toLowerCase() === 'default')) return list[0]?.id || null;
  return list.length === 1 ? list[0]?.id || null : null;
}

export async function adjustReadyMadeOrderStock(orderId: string, action: OrderStockAction): Promise<{ adjusted: number; skipped: string }> {
  const supabase = getAdminSupabase();
  const flag = action === 'confirm' ? 'stock_confirmed_at' : action === 'release' ? 'stock_released_at' : 'stock_restored_at';

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`id, order_type, ${flag}`)
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order) return { adjusted: 0, skipped: orderError?.message || 'ORDER_NOT_FOUND' };
  if (order.order_type && !['ready_made', 'product'].includes(String(order.order_type))) return { adjusted: 0, skipped: 'NOT_READY_MADE' };
  if (order[flag]) return { adjusted: 0, skipped: 'ALREADY_ADJUSTED' };

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id, product_id, quantity, sku, spec, configuration, size')
    .eq('order_id', orderId);

  if (itemsError || !items?.length) return { adjusted: 0, skipped: itemsError?.message || 'NO_ITEMS' };

  let adjusted = 0;
  const productQty = new Map<string, number>();
  for (const item of items as any[]) {
    if (!item.product_id) continue;
    const qty = Math.max(1, Number(item.quantity || 1));
    const variantId = await resolveVariantId(supabase, item);
    if (variantId) {
      const rpcName = action === 'confirm' ? 'confirm_variant_stock' : action === 'release' ? 'release_variant_stock' : 'restore_variant_stock';
      const { error } = await (supabase.rpc as any)(rpcName, { p_variant_id: variantId, p_qty: qty });
      if (error) throw new Error(error.message);
      adjusted += qty;
    } else {
      const { data: product } = await supabase.from('products').select('id, stock').eq('id', item.product_id).maybeSingle();
      if (product) {
        const nextStock = action === 'release' ? Number(product.stock || 0) : Math.max(0, Number(product.stock || 0) - qty);
        await supabase.from('products').update({ stock: nextStock, updated_at: new Date().toISOString() }).eq('id', item.product_id);
        adjusted += qty;
      }
    }
    if (action === 'confirm') productQty.set(item.product_id, (productQty.get(item.product_id) || 0) + qty);
  }

  if (action === 'confirm') {
    for (const [productId, qty] of productQty) {
      await (supabase.rpc as any)('increment_sold_count', { p_product_id: productId, p_qty: qty });
    }
  }

  await supabase.from('orders').update({ [flag]: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', orderId);
  return { adjusted, skipped: '' };
}

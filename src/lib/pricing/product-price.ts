export type PriceVariantLike = {
  price?: number | string | null;
  stock?: number | string | null;
  is_active?: boolean | null;
  enabled?: boolean | null;
};

export type ProductPriceLike = {
  base_price?: number | string | null;
  sale_price?: number | string | null;
  product_variants?: PriceVariantLike[] | null;
  variants?: PriceVariantLike[] | null;
  sizes?: PriceVariantLike[] | null;
  display_price_text?: string | null;
  effective_price?: number | null;
};

function toPositiveNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function getActiveVariantPrices(product: ProductPriceLike): number[] {
  const variants = product.product_variants || product.variants || product.sizes || [];
  return variants
    .filter((variant) => variant && variant.is_active !== false && variant.enabled !== false)
    .map((variant) => toPositiveNumber(variant.price))
    .filter((price): price is number => price !== null);
}

export function getProductPriceInfo(product: ProductPriceLike): {
  min: number | null;
  max: number | null;
  effective: number | null;
  text: string;
  hasRange: boolean;
} {
  if (product.display_price_text) {
    const effective = toPositiveNumber(product.effective_price);
    return { min: effective, max: effective, effective, text: product.display_price_text, hasRange: false };
  }

  const variantPrices = getActiveVariantPrices(product);
  if (variantPrices.length > 0) {
    const min = Math.min(...variantPrices);
    const max = Math.max(...variantPrices);
    return {
      min,
      max,
      effective: min,
      text: min === max
        ? `${min.toLocaleString('vi-VN')} VND`
        : `${min.toLocaleString('vi-VN')} - ${max.toLocaleString('vi-VN')} VND`,
      hasRange: min !== max,
    };
  }

  const singlePrice = toPositiveNumber(product.sale_price) || toPositiveNumber(product.base_price);
  return {
    min: singlePrice,
    max: singlePrice,
    effective: singlePrice,
    text: singlePrice ? `${singlePrice.toLocaleString('vi-VN')} VND` : 'Liên hệ',
    hasRange: false,
  };
}

export function getEffectiveProductPrice(product: ProductPriceLike): number {
  return getProductPriceInfo(product).effective || 0;
}

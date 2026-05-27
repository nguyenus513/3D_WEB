'use client';

type LabelValue = string | number | boolean | null | undefined | LabelMap | LabelValue[];
type LabelMap = { [key: string]: LabelValue };

const LABELS: Record<string, LabelValue> = {
  labels: {
    searchPlaceholder: 'Tìm kiếm...',
    notifications: {
      title: 'Thông báo',
      pendingLabel: '{{count}} chưa đọc',
      empty: 'Không có thông báo mới',
      viewAll: 'Xem tất cả',
    },
    status: {
      pending: 'Chờ xử lý',
      paid: 'Đã thanh toán',
    },
    orderTypes: {
      ready_made: 'Sản phẩm có sẵn',
      product: 'Sản phẩm',
      custom: 'Thiết kế riêng',
      printing: 'In 3D',
      print_3d: 'In 3D',
    },
    time: {
      justNow: 'Vừa xong',
      minutesAgo: '{{count}} phút trước',
      hoursAgo: '{{count}} giờ trước',
      daysAgo: '{{count}} ngày trước',
    },
  },
};

function readPath(source: LabelValue, path: string): LabelValue {
  return path.split('.').reduce<LabelValue>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    return (current as LabelMap)[key];
  }, source);
}

export function useUiLabels(_namespaces: string[] = []) {
  const t = <T = LabelValue>(key: string, fallback: T): T => {
    const value = readPath(LABELS, key);
    return (value === undefined ? fallback : value) as T;
  };

  const formatLabel = (template: string, values: Record<string, string | number> = {}) => {
    return Object.entries(values).reduce(
      (label, [key, value]) => label.replaceAll(`{{${key}}}`, String(value)),
      template,
    );
  };

  return { t, formatLabel };
}


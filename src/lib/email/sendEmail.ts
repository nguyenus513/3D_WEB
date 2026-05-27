import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface OrderEmailData {
  customerName: string;
  customerEmail: string;
  orderCode: string;
  orderType: 'ready_made' | 'custom' | 'printing' | 'print_3d' | string;
  total?: number;
  depositAmount?: number;
}

export interface ShippingEmailData {
  customerName: string;
  customerEmail: string;
  orderCode: string;
  shippingCode?: string;
  carrier?: string;
  shippingAddress?: {
    full_name?: string;
    phone?: string;
    address_line?: string;
    ward?: string;
    district?: string;
    province?: string;
  } | null;
}

interface CompletionEmailData {
  customerName: string;
  customerEmail: string;
  orderCode: string;
  demoImageUrl?: string;
}

interface ReviewEmailData {
  customerName: string;
  customerEmail: string;
  orderCode: string;
  demoImageUrl?: string;
  reviewLink?: string;
}

interface ApprovedEmailData {
  customerName: string;
  customerEmail: string;
  orderCode: string;
  estimatedDays?: number;
}

export interface StatusEmailData extends OrderEmailData {
  orderId: string;
  status: string;
  shippingCode?: string;
  carrier?: string;
  shippingAddress?: ShippingEmailData['shippingAddress'];
  demoImageUrl?: string;
  reviewLink?: string;
}

type EmailRow = { label: string; value: string };

function escapeHtml(value?: string | null): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.miniver.id.vn').replace(/\/$/, '');
}

function getBrandLogoUrl(): string {
  return `${getAppUrl()}/brand/miniver-logo-full.png`;
}

function renderBrandLogo(): string {
  return `<img src="${getBrandLogoUrl()}" alt="Miniver" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto" />`;
}

function formatVnd(value?: number | null): string {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('vi-VN')} VND`;
}

function orderTypeLabel(type?: string): string {
  return ({
    ready_made: 'Sản phẩm có sẵn',
    product: 'Sản phẩm có sẵn',
    custom: 'Mô hình custom',
    printing: 'In 3D',
    print_3d: 'In 3D',
  } as Record<string, string>)[String(type || '')] || 'Đơn hàng';
}

function renderRows(rows: EmailRow[]): string {
  return rows.map((row) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #e7e7e7;color:#777;font-size:14px">${escapeHtml(row.label)}</td>
      <td align="right" style="padding:14px 16px;border-bottom:1px solid #e7e7e7;color:#111;font-weight:700;font-size:14px">${escapeHtml(row.value)}</td>
    </tr>`).join('');
}

function renderEmailLayout(input: {
  badge: string;
  title: string;
  intro: string;
  rows?: EmailRow[];
  cta?: { href: string; label: string };
  note?: string;
  imageUrl?: string;
}): string {
  const rows = input.rows?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;border:1px solid #e7e7e7;border-radius:16px;overflow:hidden">${renderRows(input.rows)}</table>` : '';
  const cta = input.cta ? `<a href="${escapeHtml(input.cta.href)}" style="display:inline-block;margin-top:8px;background:#111;color:#fff;text-decoration:none;border-radius:999px;padding:13px 22px;font-weight:700;font-size:14px">${escapeHtml(input.cta.label)}</a>` : '';
  const note = input.note ? `<p style="margin-top:18px;padding:14px 16px;border-radius:16px;background:#f6f6f6;color:#555;text-align:left;font-size:14px;line-height:1.6">${escapeHtml(input.note)}</p>` : '';
  const safeImageUrl = input.imageUrl && /^https?:\/\//i.test(input.imageUrl) ? input.imageUrl : '';
  const image = safeImageUrl ? `<img src="${escapeHtml(safeImageUrl)}" alt="Miniver preview" style="display:block;width:100%;max-width:520px;margin:18px auto;border-radius:18px;border:1px solid #eee" />` : '';

  return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;background:#f2f2f2;font-family:Inter,Arial,sans-serif;color:#111">
  <div style="padding:28px 14px">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:28px;overflow:hidden;border:1px solid #e9e9e9;box-shadow:0 18px 60px rgba(0,0,0,.08)">
      <div style="padding:30px 28px 18px;text-align:center;background:#111">
        ${renderBrandLogo()}
      </div>
      <div style="padding:34px 28px 30px;text-align:center">
        <div style="display:inline-block;margin-bottom:18px;border:1px solid #111;border-radius:999px;padding:7px 13px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#111">${escapeHtml(input.badge)}</div>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111">${escapeHtml(input.title)}</h1>
        <p style="margin:0 0 22px;color:#555;font-size:15px;line-height:1.7">${escapeHtml(input.intro)}</p>
        ${image}
        ${rows}
        ${cta}
        ${note}
      </div>
      <div style="padding:24px 28px;background:#f6f6f6;color:#777;text-align:center;font-size:12px;line-height:1.6">
        © 2026 Miniver · <a href="${getAppUrl()}/privacy" style="color:#555">Chính sách bảo mật</a> · <a href="${getAppUrl()}/terms" style="color:#555">Điều khoản sử dụng</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function sendViaGmail(options: EmailOptions): Promise<{ success: boolean; rateLimited: boolean }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn('[Email/Gmail] missing Gmail env');
    return { success: false, rateLimited: false };
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
  try {
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Miniver'}" <${process.env.EMAIL_FROM || user}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    console.log('[Email/Gmail] sent', options.to);
    return { success: true, rateLimited: false };
  } catch (error: unknown) {
    const err = error as { responseCode?: number; message?: string };
    const rateLimited = err.responseCode === 454 || err.responseCode === 550 || String(err.message || '').toLowerCase().includes('limit');
    console.error('[Email/Gmail] failed', { message: err.message, to: options.to });
    return { success: false, rateLimited };
  }
}

export async function sendEmailWithFallback(options: EmailOptions): Promise<boolean> {
  if (!options.to) {
    console.warn('[Email] missing recipient');
    return false;
  }
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000));
  const send = async () => {
    console.log('[Email] provider=gmail', { to: options.to, subject: options.subject });
    const gmail = await sendViaGmail(options);
    return gmail.success;
  };
  return Promise.race([send(), timeout]);
}

export async function sendPaymentConfirmationEmail(data: OrderEmailData): Promise<boolean> {
  return sendOrderStatusUpdateEmail({
    ...data,
    orderId: '',
    status: 'confirmed',
    depositAmount: data.depositAmount || data.total || 0,
  });
}

export async function sendCompletionEmail(data: CompletionEmailData): Promise<boolean> {
  const html = renderEmailLayout({
    badge: 'Hoàn thiện',
    title: 'Đơn hàng đã hoàn thiện',
    intro: `Xin chào ${data.customerName || 'khách hàng'}, đơn ${data.orderCode} đã hoàn thiện và đang được chuẩn bị giao.`,
    imageUrl: data.demoImageUrl,
    rows: [{ label: 'Mã đơn hàng', value: data.orderCode }, { label: 'Trạng thái', value: 'Hoàn thiện' }],
    cta: { href: `${getAppUrl()}/account/orders`, label: 'Xem đơn hàng' },
  });
  return sendEmailWithFallback({ to: data.customerEmail, subject: `Đơn hàng hoàn thiện - ${data.orderCode}`, html });
}

export async function sendShippingEmail(data: ShippingEmailData): Promise<boolean> {
  return sendOrderStatusUpdateEmail({
    ...data,
    orderId: '',
    status: 'shipping',
    orderType: 'ready_made',
  });
}

export async function sendReviewEmail(data: ReviewEmailData): Promise<boolean> {
  return sendOrderStatusUpdateEmail({
    ...data,
    orderId: '',
    status: 'review',
    orderType: 'custom',
    demoImageUrl: data.demoImageUrl,
    reviewLink: data.reviewLink,
  });
}

export async function sendApprovedEmail(data: ApprovedEmailData): Promise<boolean> {
  return sendOrderStatusUpdateEmail({
    ...data,
    orderId: '',
    status: 'approved',
    orderType: 'custom',
  });
}

function statusCopy(status: string, data: StatusEmailData) {
  const orderUrl = data.orderId ? `${getAppUrl()}/account/orders/${data.orderId}` : `${getAppUrl()}/account/orders`;
  const reviewUrl = data.reviewLink || (data.orderId ? `${getAppUrl()}/account/orders/${data.orderId}/demo` : orderUrl);
  const copies: Record<string, { badge: string; title: string; intro: string; cta: { href: string; label: string }; note?: string }> = {
    pending: { badge: 'Đã nhận đơn', title: 'Miniver đã nhận đơn hàng', intro: `Đơn ${data.orderCode} đã được tạo thành công. Miniver sẽ xử lý ngay sau khi thanh toán được xác nhận.`, cta: { href: orderUrl, label: 'Xem đơn hàng' } },
    pending_confirmation: { badge: 'Đang kiểm tra thanh toán', title: 'Miniver đã nhận yêu cầu xác nhận thanh toán', intro: `Đơn ${data.orderCode} đang chờ admin kiểm tra giao dịch. Miniver sẽ gửi email xác nhận ngay khi thanh toán được duyệt.`, cta: { href: orderUrl, label: 'Xem đơn hàng' } },
    production_pending: { badge: 'Chờ sản xuất', title: 'Đơn hàng đang chờ sản xuất', intro: `Đơn ${data.orderCode} đã sẵn sàng trong hàng chờ sản xuất.`, cta: { href: orderUrl, label: 'Theo dõi đơn hàng' } },
    confirmed: { badge: 'Đã thanh toán', title: 'Miniver đã xác nhận thanh toán', intro: `Đơn ${data.orderCode} đã được xác nhận thanh toán và chuyển sang bước xử lý tiếp theo.`, cta: { href: orderUrl, label: 'Xem đơn hàng' } },
    designing: { badge: 'Đang thiết kế', title: 'Miniver đã bắt đầu thiết kế', intro: `Đơn custom ${data.orderCode} đang được đội ngũ Miniver dựng mẫu.`, cta: { href: orderUrl, label: 'Theo dõi đơn hàng' } },
    review: { badge: 'Chờ duyệt demo', title: 'Ảnh demo đã sẵn sàng', intro: `Ảnh demo cho đơn ${data.orderCode} đã sẵn sàng. Vui lòng xem và xác nhận để Miniver tiếp tục sản xuất.`, cta: { href: reviewUrl, label: 'Xem và xác nhận demo' }, note: 'Nếu cần chỉnh sửa, hãy ghi rõ phần cần sửa để Miniver xử lý chính xác.' },
    revising: { badge: 'Đang chỉnh sửa', title: 'Miniver đã nhận yêu cầu chỉnh sửa', intro: `Miniver đã ghi nhận yêu cầu chỉnh sửa cho đơn ${data.orderCode} và sẽ cập nhật demo mới.`, cta: { href: orderUrl, label: 'Theo dõi đơn hàng' } },
    approved: { badge: 'Đã duyệt demo', title: 'Demo đã được xác nhận', intro: `Cảm ơn bạn. Đơn ${data.orderCode} sẽ được chuyển sang sản xuất.`, cta: { href: orderUrl, label: 'Theo dõi sản xuất' } },
    producing: { badge: 'Đang sản xuất', title: 'Đơn hàng đang được sản xuất', intro: `Miniver đang sản xuất mô hình custom cho đơn ${data.orderCode}.`, cta: { href: orderUrl, label: 'Theo dõi đơn hàng' } },
    printing: { badge: 'Đang in 3D', title: 'File đang được in 3D', intro: `Đơn ${data.orderCode} đang trong quá trình in 3D.`, cta: { href: orderUrl, label: 'Theo dõi đơn hàng' } },
    processing: { badge: 'Đang xử lý', title: 'Đơn hàng đang được xử lý', intro: `Miniver đang chuẩn bị đơn ${data.orderCode}.`, cta: { href: orderUrl, label: 'Theo dõi đơn hàng' } },
    finished: { badge: 'Hoàn thiện', title: 'Đơn hàng đã hoàn thiện', intro: `Đơn ${data.orderCode} đã hoàn thiện và đang chuẩn bị giao hàng.`, cta: { href: orderUrl, label: 'Xem đơn hàng' } },
    shipping: { badge: 'Đang giao hàng', title: 'Đơn hàng đang được giao', intro: `Đơn ${data.orderCode} đã được bàn giao cho đơn vị vận chuyển.`, cta: { href: data.shippingCode ? `https://viettelpost.vn/tra-cuu-hanh-trinh-don?code=${encodeURIComponent(data.shippingCode)}` : orderUrl, label: 'Theo dõi vận đơn' } },
    delivered: { badge: 'Đã giao hàng', title: 'Đơn hàng đã giao thành công', intro: `Đơn ${data.orderCode} đã hoàn tất. Cảm ơn bạn đã tin tưởng Miniver.`, cta: { href: orderUrl, label: 'Xem đơn hàng' } },
    cancelled: { badge: 'Đã hủy', title: 'Đơn hàng đã được hủy', intro: `Đơn ${data.orderCode} đã được cập nhật sang trạng thái hủy. Nếu cần hỗ trợ, vui lòng liên hệ Miniver.`, cta: { href: orderUrl, label: 'Xem chi tiết' } },
  };
  return copies[status] || null;
}

export function buildOrderStatusEmailOptions(data: StatusEmailData): EmailOptions | null {
  const copy = statusCopy(data.status, data);
  if (!copy || !data.customerEmail) return null;

  const address = [
    data.shippingAddress?.address_line,
    data.shippingAddress?.ward,
    data.shippingAddress?.district,
    data.shippingAddress?.province,
  ].filter(Boolean).join(', ');
  const shouldShowShippingInfo = ['finished', 'shipping', 'delivered'].includes(data.status);
  const shouldShowPreview = data.status === 'review';
  const rows: EmailRow[] = [
    { label: 'Mã đơn hàng', value: data.orderCode },
    { label: 'Loại đơn', value: orderTypeLabel(data.orderType) },
    { label: 'Trạng thái', value: copy.badge },
  ];

  if (data.total) rows.push({ label: 'Tổng giá trị', value: formatVnd(data.total) });
  if (data.depositAmount) rows.push({ label: 'Đã thanh toán', value: formatVnd(data.depositAmount) });
  if (shouldShowShippingInfo && data.shippingAddress?.full_name) rows.push({ label: 'Người nhận', value: data.shippingAddress.full_name });
  if (shouldShowShippingInfo && data.shippingAddress?.phone) rows.push({ label: 'Số điện thoại', value: data.shippingAddress.phone });
  if (data.shippingCode) rows.push({ label: 'Mã vận đơn', value: data.shippingCode });
  if (data.carrier) rows.push({ label: 'Đơn vị vận chuyển', value: data.carrier });
  if ((shouldShowShippingInfo || data.status === 'pending' || data.status === 'confirmed') && address) rows.push({ label: 'Địa chỉ giao hàng', value: address });

  const html = renderEmailLayout({
    ...copy,
    intro: `Xin chào ${data.customerName || 'khách hàng'}, ${copy.intro}`,
    rows,
    imageUrl: shouldShowPreview ? data.demoImageUrl : undefined,
  });

  return {
    to: data.customerEmail,
    subject: `${copy.title} - ${data.orderCode}`,
    html,
  };
}

export async function sendOrderStatusUpdateEmail(data: StatusEmailData): Promise<boolean> {
  const options = buildOrderStatusEmailOptions(data);
  if (!options) return false;
  return sendEmailWithFallback(options);
}


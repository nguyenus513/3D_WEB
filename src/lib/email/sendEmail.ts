/**
 * Email Service with Fallback
 * 
 * Primary: Gmail SMTP (500/day)
 * Fallback: Brevo API (300/day)
 * Total: 800 emails/day
 * 
 * Required env:
 * - GMAIL_USER + GMAIL_APP_PASSWORD (Primary)
 * - BREVO_API_KEY (Fallback)
 */

import nodemailer from 'nodemailer';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}

interface OrderEmailData {
    customerName: string;
    customerEmail: string;
    orderCode: string;
    orderType: 'ready_made' | 'custom' | 'printing';
    total: number;
    depositAmount: number;
}

interface ShippingEmailData {
    customerName: string;
    customerEmail: string;
    orderCode: string;
    shippingCode: string;
    carrier?: string;
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

// =====================================================
// Email Senders
// =====================================================

/**
 * Send via Gmail SMTP (Primary)
 */
async function sendViaGmail(options: EmailOptions): Promise<{ success: boolean; rateLimited: boolean }> {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
        console.warn('[Email] Gmail not configured');
        return { success: false, rateLimited: false };
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 5000, // 5s to connect
        greetingTimeout: 5000,   // 5s for SMTP greeting
        socketTimeout: 10000,    // 10s for socket idle
    });

    try {
        await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || 'Miniver 3D Lab'}" <${process.env.EMAIL_FROM || user}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
        });
        console.log('[Email/Gmail] ✓ Sent to:', options.to);
        return { success: true, rateLimited: false };
    } catch (error: unknown) {
        const err = error as { responseCode?: number; message?: string };
        // Check for rate limit errors: 454, 550, or message contains 'limit'
        if (err.responseCode === 454 || err.responseCode === 550 ||
            (err.message && err.message.toLowerCase().includes('limit'))) {
            console.warn('[Email/Gmail] Rate limit hit, switching to Brevo');
            return { success: false, rateLimited: true };
        }
        console.error('[Email/Gmail] Error:', err.message);
        return { success: false, rateLimited: false };
    }
}

/**
 * Send via Brevo API (Fallback)
 */
async function sendViaBrevo(options: EmailOptions): Promise<{ success: boolean; rateLimited: boolean }> {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
        console.warn('[Email] Brevo not configured');
        return { success: false, rateLimited: false };
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: { name: process.env.EMAIL_FROM_NAME || 'Miniver 3D Lab', email: process.env.EMAIL_FROM || process.env.GMAIL_USER || 'miniver.3dlab@gmail.com' },
                to: [{ email: options.to }],
                subject: options.subject,
                htmlContent: options.html,
            }),
        });

        if (response.status === 429) {
            console.warn('[Email/Brevo] Rate limit hit (429)');
            return { success: false, rateLimited: true };
        }

        if (!response.ok) {
            const error = await response.text();
            console.error('[Email/Brevo] Error:', error);
            return { success: false, rateLimited: false };
        }

        console.log('[Email/Brevo] ✓ Sent to:', options.to);
        return { success: true, rateLimited: false };
    } catch (error) {
        console.error('[Email/Brevo] Error:', error);
        return { success: false, rateLimited: false };
    }
}

/**
 * Send email with automatic fallback
 * Gmail (500/day) → Brevo (300/day)
 */
export async function sendEmailWithFallback(options: EmailOptions): Promise<boolean> {
    // Wrap entire email sending in a 10s timeout to prevent API hang
    const timeout = new Promise<boolean>((resolve) => {
        setTimeout(() => {
            console.warn('[Email] Timeout after 10s, skipping email to:', options.to);
            resolve(false);
        }, 10000);
    });

    const send = async (): Promise<boolean> => {
        // Try Gmail first
        const gmailResult = await sendViaGmail(options);
        if (gmailResult.success) return true;

        // If Gmail rate limited OR failed, try Brevo
        if (gmailResult.rateLimited || !process.env.GMAIL_USER) {
            const brevoResult = await sendViaBrevo(options);
            if (brevoResult.success) return true;

            if (brevoResult.rateLimited) {
                console.error('[Email] Both services rate limited! Email lost:', options.to);
            }
        }

        return false;
    };

    return Promise.race([send(), timeout]);
}

// =====================================================
// Email Templates
// =====================================================

/**
 * Email 1: Xác nhận thanh toán
 */
export async function sendPaymentConfirmationEmail(data: OrderEmailData): Promise<boolean> {
    const orderTypeLabel = {
        ready_made: 'Sản phẩm có sẵn',
        custom: 'Đặt theo yêu cầu',
        printing: 'In 3D',
    }[data.orderType] || data.orderType;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f5f7;margin:0;padding:40px 0;line-height:1.5;color:#1d1d1f}
.container{max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.04)}
.header{background-color:#1d1d1f;color:#ffffff;padding:40px;text-align:center}
.logo{font-size:28px;font-weight:700;letter-spacing:-0.5px;margin:0}
.content{padding:40px}
.icon-box{width:80px;height:80px;background-color:#e8f5e9;border-radius:50%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;font-size:40px}
.emoji-icon{font-size:40px;line-height:1}
h1{font-size:24px;font-weight:600;text-align:center;margin:0 0 12px;color:#1d1d1f}
p{margin:0 0 24px;color:#86868b;font-size:16px;text-align:center}
.box{background-color:#f5f5f7;border-radius:16px;padding:24px;margin:32px 0}
.row{display:flex;justify-content:space-between;margin-bottom:12px;font-size:15px}
.row:last-child{margin-bottom:0}
.label{color:#86868b}
.value{font-weight:600;color:#1d1d1f}
.value.highlight{color:#2e7d32}
.divider{height:1px;background-color:#d2d2d7;margin:16px 0}
.total-row{display:flex;justify-content:space-between;align-items:baseline;padding-top:4px}
.total-label{font-weight:600;font-size:16px}
.total-value{font-size:24px;font-weight:700;color:#1d1d1f}
.footer{background-color:#f5f5f7;padding:32px;text-align:center;font-size:13px;color:#86868b}
.footer-links{margin-bottom:16px}
.footer-link{color:#0066cc;text-decoration:none;margin:0 8px}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">Miniver 3D Lab</div>
    </div>
    <div class="content">
        <div class="icon-box">
            <span class="emoji-icon">✅</span>
        </div>
        <h1>Thanh toán thành công</h1>
        <p>Xin chào <strong>${data.customerName}</strong>,<br>Chúng tôi đã nhận được khoản thanh toán của bạn.</p>
        
        <div class="box">
            <div class="row">
                <span class="label">Mã đơn hàng</span>
                <span class="value">${data.orderCode}</span>
            </div>
            <div class="row">
                <span class="label">Loại dịch vụ</span>
                <span class="value">${orderTypeLabel}</span>
            </div>
            <div class="row">
                <span class="label">Đã thanh toán</span>
                <span class="value highlight">${data.depositAmount.toLocaleString('vi-VN')}đ</span>
            </div>
            <div class="divider"></div>
            <div class="total-row">
                <span class="total-label">Tổng giá trị đơn</span>
                <span class="total-value">${data.total.toLocaleString('vi-VN')}đ</span>
            </div>
        </div>
        
        <p style="text-align: center; margin-bottom: 0;">
            Đơn hàng đang được chuyển sang bộ phận xử lý.<br>
            Chúng tôi sẽ thông báo khi có cập nhật mới.
        </p>
    </div>
    <div class="footer">
        <div class="footer-links">
            <a href="#" class="footer-link">Tra cứu đơn hàng</a> • 
            <a href="#" class="footer-link">Liên hệ hỗ trợ</a>
        </div>
        <p>© 2026 Miniver 3D Lab. All rights reserved.</p>
    </div>
</div>
</body>
</html>`;

    return sendEmailWithFallback({
        to: data.customerEmail,
        subject: `✅ Thanh toán thành công - ${data.orderCode}`,
        html,
    });
}

/**
 * Email 2: Hoàn thành đơn hàng
 */
export async function sendCompletionEmail(data: CompletionEmailData): Promise<boolean> {
    const demoSection = data.demoImageUrl
        ? `<div class="image-container"><img src="${data.demoImageUrl}" alt="Product Demo" class="product-image"></div>`
        : '';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f5f7;margin:0;padding:40px 0;line-height:1.5;color:#1d1d1f}
.container{max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.04)}
.header{background-color:#2e7d32;color:#ffffff;padding:40px;text-align:center}
.logo{font-size:28px;font-weight:700;letter-spacing:-0.5px;margin:0}
.content{padding:40px}
.badge{display:inline-block;padding:8px 16px;background-color:#e8f5e9;color:#2e7d32;border-radius:20px;font-weight:600;font-size:14px;margin-bottom:24px}
h1{font-size:32px;font-weight:700;text-align:center;margin:0 0 16px;color:#1d1d1f;letter-spacing:-0.5px}
p{margin:0 0 32px;color:#424245;font-size:17px;text-align:center;line-height:1.6}
.image-container{margin:0 -40px 32px;text-align:center;background-color:#fafafa;padding:40px 0}
.product-image{max-width:80%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.1);transform:rotate(-2deg);transition:transform 0.3s}
.order-info{text-align:center;background-color:#f5f5f7;padding:16px;border-radius:12px;margin-bottom:32px;display:inline-block;width:100%;box-sizing:border-box}
.code-label{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#86868b;margin-bottom:4px}
.code-value{font-size:24px;font-family:monospace;font-weight:700;color:#1d1d1f}
.cta-button{display:block;width:100%;background-color:#0071e3;color:#ffffff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:600;font-size:17px;box-sizing:border-box}
.footer{background-color:#f5f5f7;padding:32px;text-align:center;font-size:13px;color:#86868b}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">Miniver 3D Lab</div>
    </div>
    <div class="content">
        <div style="text-align: center;">
            <span class="badge">SẴN SÀNG GIAO HÀNG</span>
        </div>
        <h1>Đơn hàng đã hoàn tất! 🎉</h1>
        <p>Xin chào <strong>${data.customerName}</strong>,<br>Sản phẩm của bạn đã được hoàn thiện. Chúng tôi đã đóng gói cẩn thận và sẵn sàng giao hàng.</p>
        
        ${demoSection}
        
        <div class="order-info">
            <div class="code-label">MÃ ĐƠN HÀNG</div>
            <div class="code-value">${data.orderCode}</div>
        </div>

        <a href="#" class="cta-button">Xem chi tiết đơn hàng</a>
    </div>
    <div class="footer">
        <p>© 2026 Miniver 3D Lab. All rights reserved.</p>
    </div>
</div>
</body>
</html>`;

    return sendEmailWithFallback({
        to: data.customerEmail,
        subject: `🎉 Đơn hàng hoàn thành - ${data.orderCode}`,
        html,
    });
}

/**
 * Email 3: Thông báo giao hàng
 */
export async function sendShippingEmail(data: ShippingEmailData): Promise<boolean> {
    const carrier = data.carrier || 'Viettel Post';
    const trackingUrl = `https://viettelpost.vn/tra-cuu-hanh-trinh-don?code=${data.shippingCode}`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f5f7;margin:0;padding:40px 0;line-height:1.5;color:#1d1d1f}
.container{max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.04)}
.header{background-color:#f57c00;color:#ffffff;padding:40px;text-align:center}
.logo{font-size:28px;font-weight:700;letter-spacing:-0.5px;margin:0}
.content{padding:40px}
.truck-icon{font-size:48px;text-align:center;margin-bottom:24px}
h1{font-size:28px;font-weight:700;text-align:center;margin:0 0 16px;color:#1d1d1f}
p{margin:0 0 32px;color:#424245;font-size:16px;text-align:center}
.tracking-card{background-color:#fff3e0;border:1px solid #ffe0b2;border-radius:16px;padding:32px;text-align:center;margin-bottom:32px}
.tracking-label{font-size:14px;color:#e65100;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600}
.tracking-number{font-size:32px;font-weight:800;color:#e65100;font-family:monospace;letter-spacing:2px;margin-bottom:24px;word-break:break-all}
.track-btn{display:inline-block;background-color:#e65100;color:#ffffff;padding:12px 32px;border-radius:30px;text-decoration:none;font-weight:600;font-size:15px;transition:opacity 0.2s}
.details{background-color:#f5f5f7;border-radius:12px;padding:24px}
.detail-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px}
.detail-label{color:#86868b}
.detail-value{font-weight:600;color:#1d1d1f}
.footer{background-color:#f5f5f7;padding:32px;text-align:center;font-size:13px;color:#86868b}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">Miniver 3D Lab</div>
    </div>
    <div class="content">
        <div class="truck-icon">🚚</div>
        <h1>Đơn hàng đang trên đường đến!</h1>
        <p>Xin chào <strong>${data.customerName}</strong>,<br>Đơn vị vận chuyển đã nhận hàng. Bạn có thể theo dõi hành trình đơn hàng ngay bây giờ.</p>
        
        <div class="tracking-card">
            <div class="tracking-label">MÃ VẬN ĐƠN (${carrier})</div>
            <div class="tracking-number">${data.shippingCode}</div>
            <a href="${trackingUrl}" class="track-btn" target="_blank">Theo dõi hành trình</a>
        </div>
        
        <div class="details">
             <div class="detail-row">
                <span class="detail-label">Mã đơn hàng</span>
                <span class="detail-value">${data.orderCode}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Thời gian dự kiến</span>
                <span class="detail-value">2 - 5 ngày làm việc</span>
            </div>
            <div class="detail-row" style="margin-bottom: 0;">
                <span class="detail-label">Lưu ý</span>
                <span class="detail-value">Vui lòng để ý điện thoại</span>
            </div>
        </div>
    </div>
    <div class="footer">
        <p>© 2026 Miniver 3D Lab. All rights reserved.</p>
    </div>
</div>
</body>
</html>`;

    return sendEmailWithFallback({
        to: data.customerEmail,
        subject: `🚚 Đơn hàng đang giao - ${data.shippingCode}`,
        html,
    });
}

/**
 * Email 4: Chờ xác nhận thiết kế (Review)
 */
export async function sendReviewEmail(data: ReviewEmailData): Promise<boolean> {
    const reviewLink = data.reviewLink || '#';
    const demoSection = data.demoImageUrl
        ? `<div class="image-container"><img src="${data.demoImageUrl}" alt="Demo Design" class="product-image"></div>`
        : '';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f5f7;margin:0;padding:40px 0;line-height:1.5;color:#1d1d1f}
.container{max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.04)}
.header{background-color:#9c27b0;color:#ffffff;padding:40px;text-align:center}
.logo{font-size:28px;font-weight:700;letter-spacing:-0.5px;margin:0}
.content{padding:40px}
.icon-box{width:80px;height:80px;background-color:#f3e5f5;border-radius:50%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center}
.emoji-icon{font-size:40px;line-height:1}
h1{font-size:24px;font-weight:600;text-align:center;margin:0 0 12px;color:#1d1d1f}
p{margin:0 0 24px;color:#86868b;font-size:16px;text-align:center}
.image-container{margin:0 -40px 32px;text-align:center;background-color:#fafafa;padding:40px 0}
.product-image{max-width:80%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.1)}
.box{background-color:#f5f5f7;border-radius:16px;padding:24px;margin:32px 0;text-align:center}
.order-code{font-size:20px;font-weight:700;font-family:monospace;color:#1d1d1f}
.cta-button{display:block;width:100%;background-color:#9c27b0;color:#ffffff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:600;font-size:17px;box-sizing:border-box;margin-top:24px}
.note{background-color:#fff3e0;border:1px solid #ffe0b2;border-radius:12px;padding:16px;margin-top:24px}
.note-text{color:#e65100;font-size:14px;margin:0;text-align:center}
.footer{background-color:#f5f5f7;padding:32px;text-align:center;font-size:13px;color:#86868b}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">Miniver 3D Lab</div>
    </div>
    <div class="content">
        <div class="icon-box">
            <span class="emoji-icon">👀</span>
        </div>
        <h1>Xem bản demo thiết kế</h1>
        <p>Xin chào <strong>${data.customerName}</strong>,<br>Bản demo cho đơn hàng của bạn đã sẵn sàng để xem xét!</p>
        
        ${demoSection}
        
        <div class="box">
            <div style="color:#86868b;font-size:13px;margin-bottom:8px">MÃ ĐƠN HÀNG</div>
            <div class="order-code">${data.orderCode}</div>
        </div>
        
        <a href="${reviewLink}" class="cta-button">Xem & Xác nhận thiết kế</a>
        
        <div class="note">
            <p class="note-text">⚠️ Vui lòng xác nhận trong vòng 48 giờ để tiến hành sản xuất</p>
        </div>
    </div>
    <div class="footer">
        <p>© 2026 Miniver 3D Lab. All rights reserved.</p>
    </div>
</div>
</body>
</html>`;

    return sendEmailWithFallback({
        to: data.customerEmail,
        subject: `👀 Xem demo đơn hàng ${data.orderCode} - Chờ xác nhận`,
        html,
    });
}

/**
 * Email 5: Đã xác nhận, bắt đầu sản xuất
 */
export async function sendApprovedEmail(data: ApprovedEmailData): Promise<boolean> {
    const estimatedDays = data.estimatedDays || 5;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f5f7;margin:0;padding:40px 0;line-height:1.5;color:#1d1d1f}
.container{max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.04)}
.header{background-color:#00bcd4;color:#ffffff;padding:40px;text-align:center}
.logo{font-size:28px;font-weight:700;letter-spacing:-0.5px;margin:0}
.content{padding:40px}
.icon-box{width:80px;height:80px;background-color:#e0f7fa;border-radius:50%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center}
.emoji-icon{font-size:40px;line-height:1}
h1{font-size:24px;font-weight:600;text-align:center;margin:0 0 12px;color:#1d1d1f}
p{margin:0 0 24px;color:#86868b;font-size:16px;text-align:center}
.box{background-color:#f5f5f7;border-radius:16px;padding:24px;margin:32px 0}
.row{display:flex;justify-content:space-between;margin-bottom:12px;font-size:15px}
.row:last-child{margin-bottom:0}
.label{color:#86868b}
.value{font-weight:600;color:#1d1d1f}
.timeline{background:linear-gradient(135deg,#00bcd4,#4dd0e1);border-radius:16px;padding:24px;margin:32px 0;color:#fff}
.timeline-title{font-weight:600;margin-bottom:16px;text-align:center}
.timeline-steps{display:flex;justify-content:space-between}
.step{text-align:center;flex:1}
.step-icon{font-size:24px;margin-bottom:8px}
.step-label{font-size:12px;opacity:0.9}
.footer{background-color:#f5f5f7;padding:32px;text-align:center;font-size:13px;color:#86868b}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">Miniver 3D Lab</div>
    </div>
    <div class="content">
        <div class="icon-box">
            <span class="emoji-icon">🎉</span>
        </div>
        <h1>Thiết kế đã được duyệt!</h1>
        <p>Xin chào <strong>${data.customerName}</strong>,<br>Cảm ơn bạn đã xác nhận. Đơn hàng đang được chuyển sang sản xuất!</p>
        
        <div class="box">
            <div class="row">
                <span class="label">Mã đơn hàng</span>
                <span class="value">${data.orderCode}</span>
            </div>
            <div class="row">
                <span class="label">Trạng thái</span>
                <span class="value" style="color:#00bcd4">Đang sản xuất</span>
            </div>
            <div class="row">
                <span class="label">Thời gian dự kiến</span>
                <span class="value">${estimatedDays}-${estimatedDays + 2} ngày</span>
            </div>
        </div>
        
        <div class="timeline">
            <div class="timeline-title">Tiến trình đơn hàng</div>
            <div class="timeline-steps">
                <div class="step">
                    <div class="step-icon">✅</div>
                    <div class="step-label">Thanh toán</div>
                </div>
                <div class="step">
                    <div class="step-icon">✅</div>
                    <div class="step-label">Thiết kế</div>
                </div>
                <div class="step">
                    <div class="step-icon">✅</div>
                    <div class="step-label">Xác nhận</div>
                </div>
                <div class="step">
                    <div class="step-icon">🔄</div>
                    <div class="step-label">Sản xuất</div>
                </div>
                <div class="step">
                    <div class="step-icon">⏳</div>
                    <div class="step-label">Giao hàng</div>
                </div>
            </div>
        </div>
        
        <p style="text-align:center;margin:0">Chúng tôi sẽ thông báo khi đơn hàng sẵn sàng giao!</p>
    </div>
    <div class="footer">
        <p>© 2026 Miniver 3D Lab. All rights reserved.</p>
    </div>
</div>
</body>
</html>`;

    return sendEmailWithFallback({
        to: data.customerEmail,
        subject: `🎉 Đã xác nhận - Đơn ${data.orderCode} đang sản xuất`,
        html,
    });
}

'use client';

import { useState } from 'react';

// Copying template functions from sendEmail.ts to render safely in browser without backend dependencies
// In a real scenario, we might want an API to render these, but this is faster for preview

const generatePaymentEmail = (data: any) => {
    const labels = {
        ready_made: 'Sản phẩm có sẵn',
        custom: 'Đặt theo yêu cầu',
        printing: 'In 3D',
    };
    const orderTypeLabel = labels[data.orderType as keyof typeof labels] || data.orderType;

    return `
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
        <div class="logo">3D Print Shop</div>
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
        <p>© 2026 3D Print Shop. All rights reserved.<br>123 Đường ABC, Quận XYZ, TP.HCM</p>
    </div>
</div>
</body>
</html>
    `;
};

const generateCompletionEmail = (data: any) => {
    return `
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
        <div class="logo">3D Print Shop</div>
    </div>
    <div class="content">
        <div style="text-align: center;">
            <span class="badge">SẴN SÀNG GIAO HÀNG</span>
        </div>
        <h1>Đơn hàng đã hoàn tất! 🎉</h1>
        <p>Xin chào <strong>${data.customerName}</strong>,<br>Sản phẩm của bạn đã được in ấn, xử lý và kiểm tra chất lượng hoàn tất. Chúng tôi đã đóng gói cẩn thận và sẵn sàng giao cho đơn vị vận chuyển.</p>
        
        ${data.demoImageUrl ? `
        <div class="image-container">
            <img src="${data.demoImageUrl}" alt="Product Demo" class="product-image">
        </div>
        ` : ''}
        
        <div class="order-info">
            <div class="code-label">MÃ ĐƠN HÀNG</div>
            <div class="code-value">${data.orderCode}</div>
        </div>

        <a href="#" class="cta-button">Xem chi tiết đơn hàng</a>
    </div>
    <div class="footer">
        <p>© 2026 3D Print Shop. All rights reserved.</p>
    </div>
</div>
</body>
</html>
    `;
};

const generateShippingEmail = (data: any) => {
    return `
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
        <div class="logo">3D Print Shop</div>
    </div>
    <div class="content">
        <div class="truck-icon">🚚</div>
        <h1>Đơn hàng đang trên đường đến!</h1>
        <p>Xin chào <strong>${data.customerName}</strong>,<br>Đơn vị vận chuyển đã nhận hàng. Bạn có thể theo dõi hành trình đơn hàng ngay bây giờ.</p>
        
        <div class="tracking-card">
            <div class="tracking-label">MÃ VẬN ĐƠN (${data.carrier || 'Viettel Post'})</div>
            <div class="tracking-number">${data.shippingCode}</div>
            <a href="https://viettelpost.vn/tra-cuu-hanh-trinh-don?code=${data.shippingCode}" class="track-btn" target="_blank">Theo dõi hành trình</a>
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
        <p>© 2026 3D Print Shop. All rights reserved.</p>
    </div>
</div>
</body>
</html>
    `;
};

export default function EmailPreviewPage() {
    const [activeTab, setActiveTab] = useState<'payment' | 'completion' | 'shipping'>('payment');

    // Mock Data
    const mockData = {
        payment: {
            customerName: 'Nguyễn Nhật Minh',
            orderCode: 'A1B2C3D4E5',
            orderType: 'custom',
            depositAmount: 500000,
            total: 1000000
        },
        completion: {
            customerName: 'Nguyễn Nhật Minh',
            orderCode: 'A1B2C3D4E5',
            demoImageUrl: 'https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&q=80&w=600'
        },
        shipping: {
            customerName: 'Nguyễn Nhật Minh',
            orderCode: 'A1B2C3D4E5',
            shippingCode: 'VTP123456789',
            carrier: 'Viettel Post'
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'payment':
                return generatePaymentEmail(mockData.payment);
            case 'completion':
                return generateCompletionEmail(mockData.completion);
            case 'shipping':
                return generateShippingEmail(mockData.shipping);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sidebar Controls */}
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold mb-2">Email Templates</h1>
                        <p className="text-white/50 text-sm">Preview và kiểm tra giao diện mail</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => setActiveTab('payment')}
                            className={`p-4 rounded-xl text-left transition-all ${activeTab === 'payment' ? 'bg-white text-black font-medium' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">✅</span>
                                <div>
                                    <div className="font-medium">Xác nhận thanh toán</div>
                                    <div className={`text-xs ${activeTab === 'payment' ? 'text-black/60' : 'text-white/40'}`}>Gửi khi khách ck cọc</div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveTab('completion')}
                            className={`p-4 rounded-xl text-left transition-all ${activeTab === 'completion' ? 'bg-white text-black font-medium' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">🎉</span>
                                <div>
                                    <div className="font-medium">Hoàn thành đơn</div>
                                    <div className={`text-xs ${activeTab === 'completion' ? 'text-black/60' : 'text-white/40'}`}>Gửi kèm ảnh demo</div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveTab('shipping')}
                            className={`p-4 rounded-xl text-left transition-all ${activeTab === 'shipping' ? 'bg-white text-black font-medium' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">🚚</span>
                                <div>
                                    <div className="font-medium">Đang giao hàng</div>
                                    <div className={`text-xs ${activeTab === 'shipping' ? 'text-black/60' : 'text-white/40'}`}>Gửi kèm tracking code</div>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <h3 className="font-semibold mb-4">Supabase SMTP Config</h3>
                        <div className="space-y-4 text-xs font-mono text-white/70">
                            <div>
                                <div className="text-white/40 mb-1">Host</div>
                                <div className="bg-black/50 p-2 rounded text-green-400">smtp-relay.brevo.com</div>
                            </div>
                            <div>
                                <div className="text-white/40 mb-1">Port</div>
                                <div className="bg-black/50 p-2 rounded text-green-400">587</div>
                            </div>
                            <div>
                                <div className="text-white/40 mb-1">User</div>
                                <div className="bg-black/50 p-2 rounded text-green-400">ngynhaatminh@gmail.com</div>
                            </div>
                            <div>
                                <div className="text-white/40 mb-1">Pass</div>
                                <div className="bg-black/50 p-2 rounded text-green-400 break-all">{`[YOUR_BREVO_API_KEY]`}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="lg:col-span-2 bg-[#1C1C1E] rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                        <span className="text-xs font-mono text-white/50">HTML Preview</span>
                        <div className="flex gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500/50"></span>
                            <span className="w-3 h-3 rounded-full bg-yellow-500/50"></span>
                            <span className="w-3 h-3 rounded-full bg-green-500/50"></span>
                        </div>
                    </div>
                    <div className="flex-1 bg-white relative">
                        <iframe
                            srcDoc={renderContent()}
                            className="w-full h-full absolute inset-0 border-0"
                            title="Email Preview"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'intelligentroutex';
const seedSource = 'minimal_seed_v1';

if (!uri) throw new Error('Missing MONGODB_URI');

const now = new Date();
const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@intelligentroutex.local').toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function image(seed) {
  return `https://placehold.co/900x700/111827/ffffff?text=${encodeURIComponent(seed)}`;
}

const categories = [
  { _id: 'cat-decor', name: 'Mô hình trang trí', slug: 'mo-hinh-trang-tri', description: 'Mô hình in 3D dùng để trang trí bàn làm việc và không gian sống.', sort_order: 1 },
  { _id: 'cat-gifts', name: 'Quà tặng cá nhân hóa', slug: 'qua-tang-ca-nhan-hoa', description: 'Sản phẩm có thể cá nhân hóa tên, chữ, hình ảnh hoặc màu sắc.', sort_order: 2 },
  { _id: 'cat-cosplay', name: 'Phụ kiện cosplay', slug: 'phu-kien-cosplay', description: 'Mặt nạ, phụ kiện hóa trang và props theo yêu cầu.', sort_order: 3 },
  { _id: 'cat-tech', name: 'Linh kiện kỹ thuật', slug: 'linh-kien-ky-thuat', description: 'Chi tiết cơ khí, jig, holder và linh kiện prototype.', sort_order: 4 },
  { _id: 'cat-architecture', name: 'Mô hình kiến trúc', slug: 'mo-hinh-kien-truc', description: 'Mô hình nhà, sa bàn và mockup kiến trúc.', sort_order: 5 },
  { _id: 'cat-printing', name: 'Dịch vụ in 3D', slug: 'dich-vu-in-3d', description: 'Dịch vụ in FDM/Resin từ file STL, OBJ, 3MF.', sort_order: 6 },
  { _id: 'cat-toys', name: 'Đồ chơi sáng tạo', slug: 'do-choi-sang-tao', description: 'Đồ chơi mô hình, puzzle và vật phẩm sưu tầm.', sort_order: 7 },
];

const products = [
  { sku: 'IR-DRAGON-MINI', name: 'Mô hình Rồng Mini', slug: 'mo-hinh-rong-mini', category_id: 'cat-decor', base_price: 159000, sale_price: 129000, stock: 25, is_featured: true, tags: ['dragon', 'decor', 'gift'] },
  { sku: 'IR-NAME-KEYCHAIN', name: 'Móc khóa tên cá nhân', slug: 'moc-khoa-ten-ca-nhan', category_id: 'cat-gifts', base_price: 79000, sale_price: 59000, stock: 60, is_featured: true, tags: ['personalized', 'keychain'] },
  { sku: 'IR-PHONE-STAND', name: 'Giá đỡ điện thoại 3D', slug: 'gia-do-dien-thoai-3d', category_id: 'cat-tech', base_price: 99000, sale_price: null, stock: 40, is_featured: false, tags: ['desk', 'holder'] },
  { sku: 'IR-LOWPOLY-PLANTER', name: 'Chậu cây Low Poly', slug: 'chau-cay-low-poly', category_id: 'cat-decor', base_price: 139000, sale_price: 119000, stock: 30, is_featured: true, tags: ['low-poly', 'home'] },
  { sku: 'IR-GEAR-KIT', name: 'Bộ bánh răng kỹ thuật', slug: 'bo-banh-rang-ky-thuat', category_id: 'cat-tech', base_price: 189000, sale_price: null, stock: 18, is_featured: false, tags: ['prototype', 'gear'] },
  { sku: 'IR-ARCH-HOUSE', name: 'Mô hình nhà kiến trúc', slug: 'mo-hinh-nha-kien-truc', category_id: 'cat-architecture', base_price: 349000, sale_price: 299000, stock: 12, is_featured: true, tags: ['architecture', 'model'] },
  { sku: 'IR-COSPLAY-MASK', name: 'Mặt nạ cosplay custom', slug: 'mat-na-cosplay-custom', category_id: 'cat-cosplay', base_price: 499000, sale_price: null, stock: 8, is_featured: true, tags: ['cosplay', 'custom'] },
  { sku: 'IR-PRINT-FDM', name: 'Dịch vụ in 3D FDM theo file', slug: 'dich-vu-in-3d-fdm-theo-file', category_id: 'cat-printing', type: 'service', base_price: 50000, sale_price: null, stock: 999, is_featured: false, tags: ['fdm', 'printing'] },
  { sku: 'IR-RESIN-MINI', name: 'In resin mô hình chi tiết cao', slug: 'in-resin-mo-hinh-chi-tiet-cao', category_id: 'cat-printing', type: 'service', base_price: 120000, sale_price: null, stock: 999, is_featured: true, tags: ['resin', 'miniature'] },
  { sku: 'IR-PUZZLE-CUBE', name: 'Khối puzzle sáng tạo', slug: 'khoi-puzzle-sang-tao', category_id: 'cat-toys', base_price: 149000, sale_price: 129000, stock: 35, is_featured: false, tags: ['toy', 'puzzle'] },
];

const paymentConfigs = [
  { _id: 'paycfg-ready-made', order_type: 'ready_made', bank_code: 'MB', account_no: '0336668386', account_name: 'NGUYEN MINH NHAT', is_active: true, notes: 'Thanh toán sản phẩm có sẵn' },
  { _id: 'paycfg-custom', order_type: 'custom', bank_code: 'MB', account_no: '0336668386', account_name: 'NGUYEN MINH NHAT', is_active: true, notes: 'Đặt cọc đơn custom' },
  { _id: 'paycfg-printing', order_type: 'printing', bank_code: 'MB', account_no: '0336668386', account_name: 'NGUYEN MINH NHAT', is_active: true, notes: 'Thanh toán dịch vụ in 3D' },
];

const faqs = [
  ['Thời gian in 3D mất bao lâu?', 'Tùy kích thước và vật liệu, đơn phổ biến mất 1–3 ngày làm việc.'],
  ['Tôi có thể gửi file STL/OBJ không?', 'Có. Bạn có thể gửi STL, OBJ hoặc 3MF để nhận báo giá.'],
  ['Có hỗ trợ thiết kế theo yêu cầu không?', 'Có. Đội ngũ sẽ tư vấn và gửi demo trước khi sản xuất.'],
  ['Có cần đặt cọc không?', 'Đơn custom/in 3D thường cần đặt cọc trước khi bắt đầu.'],
  ['Có giao hàng toàn quốc không?', 'Có. Phí vận chuyển phụ thuộc địa chỉ và kích thước đơn hàng.'],
  ['Sản phẩm lỗi có được bảo hành không?', 'Có. Lỗi do sản xuất sẽ được hỗ trợ in lại hoặc hoàn tiền theo chính sách.'],
].map(([question, answer], index) => ({
  _id: `faq-${index + 1}`,
  question,
  answer,
  category: 'general',
  sort_order: index + 1,
  is_active: true,
  created_at: now,
  seed_source: seedSource,
}));

const settings = [
  { _id: 'site_name', key: 'site_name', value: 'Intelligent Route X 3D', label: 'Tên website', group_name: 'general', is_public: true },
  { _id: 'support_email', key: 'support_email', value: 'support@intelligentroutex.local', label: 'Email hỗ trợ', group_name: 'support', is_public: true },
  { _id: 'support_phone', key: 'support_phone', value: '0336668386', label: 'Số điện thoại hỗ trợ', group_name: 'support', is_public: true },
  { _id: 'default_currency', key: 'default_currency', value: 'VND', label: 'Tiền tệ mặc định', group_name: 'commerce', is_public: true },
  { _id: 'shipping_base_fee', key: 'shipping_base_fee', value: 30000, label: 'Phí ship mặc định', group_name: 'commerce', is_public: false },
];

async function upsertMany(collection, rows, key) {
  let count = 0;
  for (const row of rows) {
    const { created_at, ...setFields } = row;
    await collection.updateOne(
      { [key]: row[key] },
      { $set: { ...setFields, updated_at: now, seed_source: seedSource }, $setOnInsert: { created_at: created_at || now } },
      { upsert: true }
    );
    count += 1;
  }
  return count;
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  if (process.env.SEED_RESET === 'true') {
    for (const name of ['categories', 'products', 'payment_configs', 'faqs', 'settings']) {
      await db.collection(name).deleteMany({ seed_source: seedSource });
    }
  }

  const categoryCount = await upsertMany(db.collection('categories'), categories, 'slug');

  const productDocs = products.map((product, index) => ({
    _id: product._id || `prod-${product.sku.toLowerCase()}`,
    type: product.type || 'ready_made',
    status: 'active',
    is_active: true,
    short_description: `${product.name} được sản xuất bằng công nghệ in 3D chất lượng cao.`,
    description: `Sản phẩm ${product.name} phù hợp cho demo website, quà tặng và kiểm thử quy trình đặt hàng.`,
    cost_price: Math.round(product.base_price * 0.55),
    low_stock_alert: 5,
    images: [
      { url: image(product.name), is_main: true },
      image(`${product.name} 2`),
    ],
    video_url: null,
    sizes: [
      { name: 'Tiêu chuẩn', price: product.sale_price || product.base_price, stock: product.stock, enabled: true },
      { name: 'Lớn', price: Math.round((product.sale_price || product.base_price) * 1.45), stock: Math.max(3, Math.floor(product.stock / 2)), enabled: true },
    ],
    seo_title: product.name,
    seo_description: `${product.name} - sản phẩm in 3D tại Intelligent Route X`,
    view_count: 0,
    sold_count: 0,
    sort_order: index + 1,
    ...product,
  }));
  const productCount = await upsertMany(db.collection('products'), productDocs, 'sku');

  const paymentCount = await upsertMany(db.collection('payment_configs'), paymentConfigs, 'order_type');
  const faqCount = await upsertMany(db.collection('faqs'), faqs, '_id');
  const settingCount = await upsertMany(db.collection('settings'), settings, 'key');
  await upsertMany(db.collection('system_settings'), settings, 'key');

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await db.collection('profiles').updateOne(
    { email: adminEmail },
    {
      $set: {
        full_name: 'System Admin',
        phone: '0336668386',
        email: adminEmail,
        role: 'admin',
        customer_code: 'ADMIN-0001',
        password: passwordHash,
        email_verified: true,
        deleted_at: null,
        updated_at: now,
        seed_source: seedSource,
      },
      $setOnInsert: {
        _id: 'admin-seed-0001',
        created_at: now,
      },
    },
    { upsert: true }
  );

  const counts = {};
  for (const name of ['categories', 'products', 'payment_configs', 'faqs', 'settings', 'system_settings', 'profiles']) {
    counts[name] = await db.collection(name).countDocuments();
  }

  await client.close();

  console.log(JSON.stringify({
    ok: true,
    seed_source: seedSource,
    admin_email: adminEmail,
    admin_password_note: 'Use SEED_ADMIN_PASSWORD value; change after deploy.',
    upserted: { categories: categoryCount, products: productCount, payment_configs: paymentCount, faqs: faqCount, settings: settingCount },
    counts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



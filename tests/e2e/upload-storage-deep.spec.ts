import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@intelligentroutex.local';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'Admin@123456';
const runId = `DEEP_${Date.now()}`;

async function loginCredentials(page: Page, email: string, password: string) {
  const csrfResponse = await page.request.get('/api/auth/csrf');
  expect(csrfResponse.ok()).toBeTruthy();
  const csrfToken = (await csrfResponse.json()).csrfToken as string;
  const form = new URLSearchParams({ csrfToken, email, password, callbackUrl: '/sys_internal', json: 'true' });
  const response = await page.request.post('/api/auth/callback/credentials', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
    maxRedirects: 0,
  });
  expect([200, 302]).toContain(response.status());
}

async function addCsrfCookie(page: Page) {
  const baseUrl = test.info().project.use.baseURL || 'https://www.miniver.id.vn';
  const host = new URL(String(baseUrl)).hostname;
  const csrf = `${runId}_csrf_${Math.random().toString(16).slice(2)}`;
  await page.context().addCookies([{ name: '__Host-csrf-token', value: csrf, domain: host, path: '/', secure: true, httpOnly: true, sameSite: 'Strict' }]);
  return csrf;
}

async function uploadViaR2(page: Page, csrf: string, fileName: string, contentType: string, body: Uint8Array, params: Record<string, unknown>) {
  const presign = await page.evaluate(async ({ csrf, fileName, contentType, size, params }) => {
    const res = await fetch('/api/uploads/presign', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ fileName, contentType, size, params }),
    });
    return { status: res.status, body: await res.json() };
  }, { csrf, fileName, contentType, size: body.byteLength, params });
  expect(presign.status, JSON.stringify(presign.body)).toBe(200);

  const put = await fetch(presign.body.data.url, { method: 'PUT', headers: { 'content-type': contentType }, body: body as BodyInit });
  expect(put.status).toBe(200);

  const complete = await page.evaluate(async ({ csrf, key, fileName, contentType, size }) => {
    const res = await fetch('/api/uploads/complete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ key, fileName, contentType, size, isPublic: false }),
    });
    return { status: res.status, body: await res.json() };
  }, { csrf, key: presign.body.data.key, fileName, contentType, size: body.byteLength });
  expect(complete.status, JSON.stringify(complete.body)).toBe(200);

  return {
    key: presign.body.data.key as string,
    fileId: complete.body.data.file.fileId as string,
    url: complete.body.data.file.url as string,
    publicUrl: presign.body.data.publicUrl as string,
  };
}

test.describe('deep upload persistence', () => {
  test('custom image upload is stored in R2, linked in Mongo, visible to admin', async ({ page }) => {
    await loginCredentials(page, adminEmail, adminPassword);
    await page.goto('/sys_internal', { waitUntil: 'networkidle' });
    const csrf = await addCsrfCookie(page);
    const uploaded = await uploadViaR2(page, csrf, `${runId}.png`, 'image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), {
      type: 'custom_single', customType: 'single', personCount: 1, photoCategory: 'main', index: 1,
    });

    const created = await page.request.post('/api/orders/custom', {
      data: {
        type: 'single',
        size: 'S',
        notes: `${runId} custom image`,
        shippingAddress: { full_name: 'Deep Test', phone: '0900000000', address_line: '1 Test', ward: 'Ward', district: 'District', province: 'HCM' },
        images: [{ id: uploaded.key, fileId: uploaded.fileId, name: `${runId}.png`, url: uploaded.url, thumbnail: uploaded.url, type: 'image/png', size: 8, category: 'main', characterIndex: 1 }],
      },
    });
    expect(created.status()).toBe(200);
    const body = await created.json();
    const orderId = body.data?.orderId || body.orderId;
    expect(orderId).toBeTruthy();

    const detail = await page.request.get(`/api/admin/orders/${orderId}`);
    expect(detail.status()).toBe(200);
    const detailBody = await detail.json();
    const files = detailBody.data.order.order_files || [];
    expect(files.some((file: any) => file.file_key === uploaded.url || file.file_key === uploaded.key || file.file_url?.includes(uploaded.key))).toBeTruthy();
  });

  test('STL upload is stored in R2, linked in Mongo, visible to admin', async ({ page }) => {
    await loginCredentials(page, adminEmail, adminPassword);
    await page.goto('/sys_internal', { waitUntil: 'networkidle' });
    const csrf = await addCsrfCookie(page);
    const stl = new TextEncoder().encode(`solid ${runId}\nendsolid ${runId}\n`);
    const uploaded = await uploadViaR2(page, csrf, `${runId}.stl`, 'model/stl', stl, {
      type: 'printing', tech: 'fdm', infill: 20, layerHeight: '0.2', color: 'white', index: 1,
    });

    const created = await page.request.post('/api/orders/printing', {
      data: {
        items: [{ quantity: 1, analysis: { volume: 1, grams: 10, hours: 1, price: 10000 } }],
        files: [{ id: uploaded.key, fileId: uploaded.fileId, name: `${runId}.stl`, size: stl.byteLength, type: 'model/stl', url: uploaded.url }],
        type: 'fdm', color: 'white', infill: '20', layerHeight: '0.2', notes: `${runId} stl`, totalPrice: 10000,
        shippingAddress: { full_name: 'Deep Test', phone: '0900000000', address_line: '1 Test', ward: 'Ward', district: 'District', province: 'HCM' },
      },
    });
    expect(created.status()).toBe(200);
    const body = await created.json();
    expect(body.orderId).toBeTruthy();

    const detail = await page.request.get(`/api/admin/orders/${body.orderId}`);
    expect(detail.status()).toBe(200);
    const detailBody = await detail.json();
    const files = detailBody.data.order.order_files || [];
    expect(files.some((file: any) => file.file_type === 'model/stl' && (file.file_key === uploaded.url || file.file_key === uploaded.key || file.file_url?.includes(uploaded.key)))).toBeTruthy();
  });
});

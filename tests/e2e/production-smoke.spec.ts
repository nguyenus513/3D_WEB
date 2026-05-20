import { expect, type APIRequestContext, type Page, test } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@intelligentroutex.local';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'Admin@123456';
const runId = `SMOKE_${Date.now()}`;
const createdEmails: string[] = [];
const createdR2Urls: string[] = [];

async function readJson(response: { json(): Promise<unknown> }) {
  return response.json() as Promise<any>;
}

async function expectOkApi(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.ok(), `${path} should be OK`).toBeTruthy();
  return readJson(response);
}

async function loginCredentials(page: Page, email: string, password: string) {
  const csrfResponse = await page.request.get('/api/auth/csrf');
  expect(csrfResponse.ok()).toBeTruthy();
  const csrfToken = (await csrfResponse.json()).csrfToken as string;
  const form = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: '/sys_internal',
    json: 'true',
  });
  const response = await page.request.post('/api/auth/callback/credentials', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
    maxRedirects: 0,
  });
  expect([200, 302]).toContain(response.status());
}

async function csrfFromNextAuth(request: APIRequestContext) {
  const response = await request.get('/api/auth/csrf');
  expect(response.ok()).toBeTruthy();
  return (await readJson(response)).csrfToken as string;
}

test.describe('production smoke: infra, auth, db, r2, admin, security', () => {
  test('health, core public APIs, domain, DB are healthy', async ({ request }) => {
    const health = await expectOkApi(request, '/api/health');
    expect(health.status).toBe('healthy');
    expect(health.services.database.status).toBe('up');
    expect(health.services.database.db).toBe('intelligentroutex');

    const products = await expectOkApi(request, '/api/public/products');
    expect(products.success).toBe(true);
    expect(Array.isArray(products.data)).toBe(true);
    expect(products.data.length).toBeGreaterThan(0);

    const categories = await expectOkApi(request, '/api/public/categories');
    expect(categories.success).toBe(true);
    expect(categories.data.length).toBeGreaterThan(0);

    const featured = await expectOkApi(request, '/api/featured-products');
    expect(featured.success).toBe(true);
  });

  test('public UI pages render without hard failures', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    for (const path of ['/', '/products', '/custom', '/printing', '/faq', '/login', '/register']) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();
      await expect(page).not.toHaveURL(/500|404/);
    }

    expect(consoleErrors.filter(error => !/favicon|ResizeObserver|ERR_NAME_NOT_RESOLVED/i.test(error))).toEqual([]);
  });

  test('Google OAuth provider and redirect are configured', async ({ page, request }) => {
    const providers = await expectOkApi(request, '/api/auth/providers');
    expect(providers.google.id).toBe('google');
    expect(providers.google.callbackUrl).toContain('/api/auth/callback/google');

    await page.goto('/login', { waitUntil: 'networkidle' });
    const googleButton = page.getByRole('button', { name: /google/i });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
    await googleButton.click();
    await page.waitForURL(url => url.href.includes('accounts.google.com'), { timeout: 45_000 });
    expect(page.url()).toContain('client_id=416511203884');
    expect(decodeURIComponent(page.url())).toContain('/api/auth/callback/google');
  });

  test('register creates user in MongoDB and login works', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Register write smoke runs once to avoid production rate limits.');
    const email = `smoke_${Date.now()}@example.com`;
    createdEmails.push(email);

    const response = await request.post('/api/auth/register', {
      data: { name: `${runId} User`, email, password: 'UserSmoke123!' },
    });
    if (response.status() === 429) test.skip(true, 'Production register rate-limit reached; prior register smoke already exercised endpoint.');
    expect(response.status()).toBe(201);
    const body = await readJson(response);
    expect(body.success).toBe(true);
    expect(body.data.userId).toBeTruthy();

    await loginCredentials(page, email, 'UserSmoke123!');
    expect((await page.request.get('/api/profile')).status()).toBe(200);
  });

  test('admin credentials unlock protected admin APIs', async ({ page, request }) => {
    await loginCredentials(page, adminEmail, adminPassword);
    await page.goto('/sys_internal', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/sys_internal/);

    for (const path of ['/api/profile', '/api/admin/stats', '/api/admin/products', '/api/admin/settings']) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(200);
    }
  });

  test('R2 presign, upload, public read work for product image', async ({ page }) => {
    await loginCredentials(page, adminEmail, adminPassword);
    expect((await page.request.get('/api/profile')).status()).toBe(200);
    await page.goto('/sys_internal', { waitUntil: 'networkidle' });

    const appCsrf = `${runId}_csrf_token_1234567890`;
    await page.context().addCookies([{ name: '__Host-csrf-token', value: appCsrf, domain: 'www.miniver.id.vn', path: '/', secure: true, httpOnly: true, sameSite: 'Strict' }]);

        const presign = await page.evaluate(async ({ csrf, runId }) => {
      const response = await fetch('/api/uploads/presign', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          fileName: `${runId}.png`,
          contentType: 'image/png',
          size: 12,
          params: { type: 'product', sku: runId, index: 1 },
        }),
      });
      return { status: response.status, body: await response.json() };
    }, { csrf: appCsrf, runId });
    expect(presign.status).toBe(200);
    const data = presign.body.data;
    expect(data.publicUrl).toContain('pub-5df6980cd6d24df8a7221eaf1d7ce060.r2.dev');
    createdR2Urls.push(data.publicUrl);

    const put = await requestPut(data.url, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), 'image/png');
    expect(put).toBe(200);

    const publicGet = await page.request.get(data.publicUrl);
    expect(publicGet.status()).toBe(200);
  });

  test('security: anonymous and customer cannot access admin APIs', async ({ browser, request }) => {
    expect((await request.get('/api/admin/stats')).status()).toBe(401);

    const context = await browser.newContext();
    const page = await context.newPage();
    const email = `smoke_customer_${Date.now()}@example.com`;
    createdEmails.push(email);
    await request.post('/api/auth/register', { data: { name: `${runId} Customer`, email, password: 'UserSmoke123!' } });
    await loginCredentials(page, email, 'UserSmoke123!');
    const forbidden = await page.request.get('/api/admin/stats');
    expect([401, 403]).toContain(forbidden.status());
    await context.close();
  });

  test('order/payment surfaces are reachable and protected', async ({ page, request }) => {
    expect((await request.get('/api/orders/my-orders')).status()).toBe(401);
    await loginCredentials(page, adminEmail, adminPassword);
    expect((await page.request.get('/api/profile')).status()).toBe(200);
    await page.goto('/sys_internal/orders', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/500|404/);
        expect((await page.request.get('/api/admin/orders')).status()).toBe(200);
    expect((await page.request.get('/api/payment-config')).status()).toBe(200);
  });
});

async function requestPut(url: string, body: Uint8Array, contentType: string) {
  const response = await fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body: body as BodyInit });
  return response.status;
}










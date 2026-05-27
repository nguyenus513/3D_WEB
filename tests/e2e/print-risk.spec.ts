import { expect, test, type Page } from '@playwright/test';

const userEmail = process.env.E2E_USER_EMAIL || 'ngynhaatminh@gmail.com';
const userPassword = process.env.E2E_USER_PASSWORD || 'Nhatminh2004@';

async function loginCredentials(page: Page, email: string, password: string) {
  const csrfResponse = await page.request.get('/api/auth/csrf');
  expect(csrfResponse.ok()).toBeTruthy();
  const csrfToken = (await csrfResponse.json()).csrfToken as string;
  const form = new URLSearchParams({ csrfToken, email, password, callbackUrl: '/printing', json: 'true' });
  const response = await page.request.post('/api/auth/callback/credentials', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
    maxRedirects: 0,
  });
  expect([200, 302]).toContain(response.status());
}

const tinyTetraStl = `solid tiny
facet normal 0 0 1
 outer loop
  vertex 0 0 0
  vertex 20 0 0
  vertex 0 20 0
 endloop
endfacet
facet normal 0 -1 0
 outer loop
  vertex 0 0 0
  vertex 0 0 20
  vertex 20 0 0
 endloop
endfacet
facet normal -1 0 0
 outer loop
  vertex 0 0 0
  vertex 0 20 0
  vertex 0 0 20
 endloop
endfacet
facet normal 1 1 1
 outer loop
  vertex 20 0 0
  vertex 0 0 20
  vertex 0 20 0
 endloop
endfacet
endsolid tiny
`;

test.describe('print risk analysis', () => {
  test.skip(process.env.RUN_PRINT_RISK_E2E !== '1', 'Set RUN_PRINT_RISK_E2E=1 after deploying the new route.');

  test('authenticated user can analyze STL risk', async ({ page }) => {
    await loginCredentials(page, userEmail, userPassword);

    const response = await page.request.post('/api/printing/analyze-risk', {
      multipart: {
        type: 'fdm',
        infill: '20%',
        layerHeight: '0.2',
        file: {
          name: 'tiny-risk-test.stl',
          mimeType: 'model/stl',
          buffer: Buffer.from(tinyTetraStl, 'utf8'),
        },
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(['low', 'medium', 'high']).toContain(body.riskLevel);
    expect(typeof body.riskScore).toBe('number');
    expect(Array.isArray(body.issues)).toBeTruthy();
    expect(Array.isArray(body.suggestions)).toBeTruthy();
    expect(body.metrics?.boundingBox?.x).toBeGreaterThan(0);
    expect(body.metrics?.triangleCount).toBe(4);
  });
});

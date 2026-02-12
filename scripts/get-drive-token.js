#!/usr/bin/env node
/**
 * Standalone Google Drive OAuth Token Generator
 * 
 * This script:
 * 1. Starts a local HTTP server on port 3333
 * 2. Opens Google OAuth consent screen in browser
 * 3. Captures the authorization code
 * 4. Exchanges it for access_token + refresh_token
 * 5. Saves encrypted tokens to Supabase system_settings table
 * 
 * Usage: node scripts/get-drive-token.js
 * 
 * Prerequisites:
 * - Add http://localhost:3333/callback to Google Cloud Console > Credentials > Authorized redirect URIs
 * - Ensure .env.local has GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, SUPABASE configs
 */

const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ─── Load .env.local ────────────────────────────────────────────────
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env.local not found');
        process.exit(1);
    }
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnv();

// ─── Config ─────────────────────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

console.log('\n🔧 Google Drive OAuth Token Generator\n');
console.log('Config:');
console.log(`  Client ID: ${CLIENT_ID?.substring(0, 20)}...`);
console.log(`  Supabase:  ${SUPABASE_URL}`);
console.log(`  Redirect:  ${REDIRECT_URI}`);
console.log('');

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env.local');
    process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

// ─── Encryption (matching token-encryption.ts) ──────────────────────
function encryptToken(text) {
    if (!text || !ENCRYPTION_KEY) return text;
    try {
        const key = Buffer.from(ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch {
        console.warn('⚠️  Encryption failed, storing plaintext');
        return text;
    }
}

// ─── Google OAuth ───────────────────────────────────────────────────
function getAuthUrl() {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
        access_type: 'offline',
        prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code) {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Token exchange failed: ${err}`);
    }
    return resp.json();
}

async function saveToSupabase(tokens) {
    const tokenData = {
        access_token: encryptToken(tokens.access_token),
        refresh_token: encryptToken(tokens.refresh_token),
        expiry_date: Date.now() + (tokens.expires_in * 1000),
        updated_at: new Date().toISOString(),
    };

    const body = {
        key: 'google_drive_tokens',
        value: tokenData,
        updated_at: new Date().toISOString(),
    };

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?on_conflict=key`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Supabase save failed: ${err}`);
    }
    return true;
}

// ─── HTTP Server ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>❌ Lỗi: ${error}</h1><p>Vui lòng thử lại.</p>`);
            console.error(`❌ OAuth error: ${error}`);
            server.close();
            process.exit(1);
        }

        if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>❌ Không nhận được code</h1>');
            server.close();
            process.exit(1);
        }

        try {
            console.log('📤 Exchanging code for tokens...');
            const tokens = await exchangeCode(code);

            console.log('✅ Tokens received:');
            console.log(`   access_token:  ${tokens.access_token?.substring(0, 20)}...`);
            console.log(`   refresh_token: ${tokens.refresh_token ? 'YES' : 'NO'}`);
            console.log(`   expires_in:    ${tokens.expires_in}s`);

            if (!tokens.refresh_token) {
                console.warn('⚠️  No refresh_token! Make sure prompt=consent is set.');
            }

            console.log('💾 Saving to Supabase...');
            await saveToSupabase(tokens);
            console.log('✅ Tokens saved to system_settings!');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <h1 style="color:green">✅ Kết nối Google Drive thành công!</h1>
                <p>Tokens đã được lưu vào database.</p>
                <p>Bạn có thể đóng tab này và quay lại ứng dụng.</p>
                <p><strong>Refresh token:</strong> ${tokens.refresh_token ? 'Có ✅' : 'Không ❌'}</p>
                <script>setTimeout(() => window.close(), 3000)</script>
            `);
        } catch (err) {
            console.error('❌ Error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>❌ Lỗi</h1><pre>${err.message}</pre>`);
        }

        setTimeout(() => {
            server.close();
            process.exit(0);
        }, 2000);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    const authUrl = getAuthUrl();
    console.log(`🌐 Server listening on port ${PORT}`);
    console.log(`\n👉 Mở link sau trong trình duyệt:\n`);
    console.log(authUrl);
    console.log(`\n⏳ Đang chờ bạn đăng nhập Google...\n`);

    // Try to open browser automatically
    const { exec } = require('child_process');
    const cmd = process.platform === 'win32' ? 'start' :
        process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${cmd} "${authUrl}"`);
});

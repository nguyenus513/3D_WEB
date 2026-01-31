
import { createClient } from '@supabase/supabase-js';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Load env from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Loaded .env.local');
} else {
    console.warn('.env.local not found, checking process env');
}

async function verifySupabase() {
    console.log('\n--- Checking Supabase ---');
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) throw new Error('Existing credentials missing');

        const sb = createClient(url, key);
        const { data, error } = await sb.from('profiles').select('count').limit(1).single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is just "no rows" which is fine for count
        console.log('✅ Supabase Connection OK');
    } catch (e) {
        console.error('❌ Supabase Failed:', (e as Error).message);
    }
}

async function verifyR2() {
    console.log('\n--- Checking Cloudflare R2 ---');
    try {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

        if (!accountId || !accessKeyId || !secretAccessKey) throw new Error('R2 credentials missing');

        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
        });

        await s3.send(new ListBucketsCommand({}));
        console.log('✅ R2 Connection OK');
    } catch (e) {
        console.error('❌ R2 Failed:', (e as Error).message);
    }
}

async function verifyDrive() {
    console.log('\n--- Checking Google Drive (Service Account) ---');
    try {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const key = process.env.GOOGLE_PRIVATE_KEY;
        if (!email || !key) {
            console.log('⚠️ Service Account not configured (Skipping)');
            return;
        }

        const auth = new google.auth.JWT({
            email,
            key: key.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });
        await drive.files.list({ pageSize: 1 });
        console.log('✅ Drive Service Account OK');
    } catch (e) {
        console.error('❌ Drive Service Account Failed:', (e as Error).message);
    }
}

async function main() {
    await verifySupabase();
    await verifyR2();
    await verifyDrive();
    console.log('\nVerification Complete.');
}

main().catch(console.error);

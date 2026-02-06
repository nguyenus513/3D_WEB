/* eslint-disable no-console */
/**
 * Archive Cron Trigger
 * Calls /api/tasks/archive-completed with x-archive-secret header.
 */

const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const baseUrl = process.env.ARCHIVE_JOB_URL || process.env.NEXT_PUBLIC_APP_URL;
const secret = process.env.ARCHIVE_JOB_SECRET;

if (!baseUrl) {
    console.error('Missing ARCHIVE_JOB_URL or NEXT_PUBLIC_APP_URL');
    process.exit(1);
}

if (!secret) {
    console.error('Missing ARCHIVE_JOB_SECRET');
    process.exit(1);
}

const endpoint = new URL('/api/tasks/archive-completed', baseUrl).toString();

(async () => {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'x-archive-secret': secret,
            },
        });

        const text = await response.text();
        let payload = null;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = text;
        }

        if (!response.ok) {
            console.error('Archive cron failed:', payload || response.statusText);
            process.exit(1);
        }

        console.log('Archive cron success:', payload);
    } catch (error) {
        console.error('Archive cron error:', error);
        process.exit(1);
    }
})();

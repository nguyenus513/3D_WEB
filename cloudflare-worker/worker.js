/**
 * Cloudflare Worker Proxy for R2
 * 
 * Provides secure access to private R2 bucket with caching and headers.
 * 
 * Setup:
 * 1. Create Worker in Cloudflare Dashboard
 * 2. Settings -> Variables -> R2 Bucket Helper -> Bind 'R2_BUCKET' to 'miniver3d'
 * 3. Settings -> Triggers -> Custom Domains -> Add your domain (e.g. cdn.miniver3d.com)
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const key = url.pathname.slice(1); // Remove leading slash

        // 1. Security: Only allow GET and HEAD requests
        if (!['GET', 'HEAD'].includes(request.method)) {
            return new Response('Method Not Allowed', { status: 405 });
        }

        // 2. Security: Block list bucket (empty key)
        if (!key || key === '') {
            return new Response('Forbidden', { status: 403 });
        }

        try {
            // 3. Fetch object from R2 bucket
            // env.R2_BUCKET is the binding name you set in Dashboard
            const object = await env.R2_BUCKET.get(key);

            // 4. Handle 404 Not Found
            if (!object) {
                return new Response('Object Not Found', { status: 404 });
            }

            // 5. Build response headers
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);

            // Cache Control:
            // - Product images (permanent): Long cache (1 year)
            // - Order images (temporary): Short cache or private
            // - Default: 1 day
            if (key.startsWith('products/')) {
                headers.set('Cache-Control', 'public, max-age=31536000, immutable');
            } else if (key.startsWith('orders/')) {
                headers.set('Cache-Control', 'public, max-age=3600');
            } else {
                headers.set('Cache-Control', 'public, max-age=86400');
            }

            // Security Headers
            headers.set('X-Content-Type-Options', 'nosniff');
            headers.set('Access-Control-Allow-Origin', '*'); // Allow CORS for frontend

            // 6. Return response
            return new Response(object.body, {
                headers,
            });

        } catch (error) {
            return new Response(`Error: ${error.message}`, { status: 500 });
        }
    },
};

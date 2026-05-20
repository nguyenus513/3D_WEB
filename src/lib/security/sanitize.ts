/**
 * Security Sanitization Utilities
 * 
 * Provides XSS protection for user-generated content.
 * Avoids DOM-dependent packages so API routes remain compatible with
 * serverless runtimes.
 */

const ALLOWED_TAGS = new Set([
    'b', 'i', 'u', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
    'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
]);

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'class', 'id']);
const URI_ATTRS = new Set(['href']);

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for any user-generated HTML content before rendering
 * 
 * @example
 * const safeHtml = sanitizeHtml(userContent);
 * <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
 */
export function sanitizeHtml(dirty: string): string {
    if (!dirty) return '';

    return dirty
        .replace(/<!--([\s\S]*?)-->/g, '')
        .replace(/<(script|style|iframe|form|input|button)\b[\s\S]*?<\/\1>/gi, '')
        .replace(/<(script|style|iframe|form|input|button)\b[^>]*\/?>/gi, '')
        .replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (match, tagName: string, rawAttrs: string) => {
            const tag = tagName.toLowerCase();
            if (!ALLOWED_TAGS.has(tag)) return '';

            if (match.startsWith('</')) return `</${tag}>`;
            if (tag === 'br') return '<br>';

            const attrs = sanitizeAttributes(rawAttrs);
            return `<${tag}${attrs}>`;
        });
}

/**
 * Strip all HTML tags, leaving only plain text
 * Use for inputs that should never contain HTML
 * 
 * @example
 * const safeName = stripHtml(userInput);
 */
export function stripHtml(dirty: string): string {
    if (!dirty) return '';
    return dirty
        .replace(/<!--([\s\S]*?)-->/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '');
}

function sanitizeAttributes(rawAttrs: string): string {
    const attrs: string[] = [];
    const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(rawAttrs)) !== null) {
        const attrName = match[1].toLowerCase();
        if (!ALLOWED_ATTRS.has(attrName) || attrName.startsWith('on')) continue;

        const rawValue = (match[2] || '').replace(/^['"]|['"]$/g, '');
        if (URI_ATTRS.has(attrName) && sanitizeUrl(rawValue) === '') continue;

        attrs.push(`${attrName}="${escapeHtml(rawValue)}"`);
    }

    return attrs.length ? ` ${attrs.join(' ')}` : '';
}

/**
 * Sanitize for safe display in text contexts
 * Escapes HTML entities without allowing any tags
 */
export function escapeHtml(text: string): string {
    if (!text) return '';

    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;',
    };

    return text.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Validate and sanitize URL to prevent javascript: and data: URLs
 */
export function sanitizeUrl(url: string): string {
    if (!url) return '';

    // Check for dangerous protocols
    const dangerous = /^(javascript|data|vbscript):/i;
    if (dangerous.test(url.trim())) {
        return '';
    }

    // Only allow http, https, mailto, tel
    const allowed = /^(https?|mailto|tel):/i;
    if (!allowed.test(url.trim()) && !url.startsWith('/') && !url.startsWith('#')) {
        // Relative URLs are ok, but prefix unknown protocols
        if (url.includes(':')) {
            return '';
        }
    }

    return url;
}

/**
 * Sanitize object keys and string values recursively
 * Use for sanitizing API payloads
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = stripHtml(key);

        if (typeof value === 'string') {
            result[sanitizedKey] = stripHtml(value);
        } else if (Array.isArray(value)) {
            result[sanitizedKey] = value.map(item =>
                typeof item === 'string' ? stripHtml(item) : item
            );
        } else if (value && typeof value === 'object') {
            result[sanitizedKey] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[sanitizedKey] = value;
        }
    }

    return result as T;
}

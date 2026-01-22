/**
 * Security Sanitization Utilities
 * 
 * Provides XSS protection for user-generated content.
 * Uses isomorphic-dompurify for both server and client.
 */

import DOMPurify from 'isomorphic-dompurify';

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

    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [
            'b', 'i', 'u', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
            'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['target'], // Force target for links
        FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
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
    return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
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

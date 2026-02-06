/**
 * Proxy entrypoint (Next.js 16 compatibility)
 * Re-export root middleware to avoid divergence.
 */

export { middleware as proxy, middleware, config } from '../middleware';

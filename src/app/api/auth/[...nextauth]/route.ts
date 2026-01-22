/**
 * NextAuth API Route Handler
 * This handles all /api/auth/* routes
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;

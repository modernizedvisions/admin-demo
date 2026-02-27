import { getAdminSession } from '../_lib/adminAuth';
import { forbidIfDemo, isDemoEnv } from '../_lib/demoGuard';

type MiddlewareContext = {
  request: Request;
  env: any;
  next: () => Promise<Response>;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const normalizePath = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

const isLoginEndpoint = (pathname: string): boolean => normalizePath(pathname) === '/api/admin/auth/login';

const isDemoWriteAllowed = (pathname: string): boolean => {
  if (/^\/api\/admin\/orders\/[^/]+\/shipments\/[^/]+\/quotes$/.test(pathname)) return true;
  if (/^\/api\/admin\/orders\/[^/]+\/shipments\/[^/]+\/buy$/.test(pathname)) return true;
  if (pathname === '/api/admin/custom-orders/quotes') return true;
  return false;
};

export const onRequest = async (context: MiddlewareContext): Promise<Response> => {
  const method = context.request.method.toUpperCase();
  const pathname = new URL(context.request.url).pathname;

  if (isDemoEnv(context.env)) {
    if (method === 'OPTIONS') return context.next();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return context.next();
    if (isDemoWriteAllowed(pathname)) return context.next();
    return (
      forbidIfDemo(context.env) ||
      json({ ok: false, error: 'Demo mode: write disabled' }, 403)
    );
  }

  if (method === 'OPTIONS') {
    return context.next();
  }

  if (isLoginEndpoint(pathname)) {
    return context.next();
  }

  const session = await getAdminSession(context.env, context.request);
  if (!session) {
    return json({ ok: false, code: 'ADMIN_UNAUTH' }, 401);
  }

  return context.next();
};

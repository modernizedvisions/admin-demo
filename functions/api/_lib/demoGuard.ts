export const isDemoEnv = (env: Record<string, unknown> | undefined | null): boolean =>
  String((env as Record<string, unknown> | null)?.DEMO_ADMIN || '') === '1';

export const forbidIfDemo = (env: Record<string, unknown> | undefined | null): Response | null => {
  if (!isDemoEnv(env)) return null;
  return new Response(JSON.stringify({ error: 'Demo mode: write disabled' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
};

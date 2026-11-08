import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessConcierge } from '@/lib/concierge/access.mjs';
import { readQueueConfig } from '@/lib/concierge/secure-queue.mjs';

/** Reuse one server-side permission boundary for all queue API actions. */
export async function approvedOperator(request: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session && canAccessConcierge(session.user.id, process.env.ELLIE_ADMIN_USER_IDS)
    ? session.user.id : null;
}
export function sameOriginWrite(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === request.nextUrl.origin);
}
export function jsonNoStore(body: unknown, status = 200): Response {
  return Response.json(body, {status,headers:{'Cache-Control':'private, no-store, max-age=0'}});
}
export function configuredQueue(): ReturnType<typeof readQueueConfig> | null {
  try {
    const config = readQueueConfig(process.env);
    return config.enabled ? config : null;
  } catch {
    // Never send key, database or feature-configuration details to clients.
    return null;
  }
}
export async function readBoundedJson(request: NextRequest, maxBytes = 512): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null;
  const declaredSize = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(declaredSize) || declaredSize > maxBytes) return null;
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

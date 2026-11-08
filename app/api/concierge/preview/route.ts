import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessConcierge } from '@/lib/concierge/access.mjs';
import { triageEnquiry } from '@/agent/lead-triage.mjs';

// This route is an operator-only simulator. Never connect it to public traffic.
export const dynamic = 'force-dynamic';

function noStore(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !canAccessConcierge(session.user.id, process.env.ELLIE_ADMIN_USER_IDS)) {
    return noStore({ error: 'Not found' }, 404);
  }
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) return noStore({ error: 'Invalid origin' }, 403);
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) return noStore({ error: 'JSON required' }, 415);
  const length = Number(request.headers.get('content-length') || '0');
  if (!Number.isFinite(length) || length > 8_000) return noStore({ error: 'Request too large' }, 413);

  try {
    const raw = await request.text();
    if (raw.length > 8_000) return noStore({ error: 'Request too large' }, 413);
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return noStore({ error: 'Enquiry must be an object' }, 422);
    }
    const result = triageEnquiry(input);
    return noStore({ previewOnly: true, dataPersisted: false, result });
  } catch {
    return noStore({ error: 'Invalid enquiry payload' }, 422);
  }
}

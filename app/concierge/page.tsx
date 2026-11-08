import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canAccessConcierge } from '@/lib/concierge/access.mjs';
import { ConciergeDesk } from './_components/concierge-desk';

export const dynamic = 'force-dynamic';

export default async function ConciergePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAccessConcierge(session.user.id, process.env.ELLIE_ADMIN_USER_IDS)) {
    notFound();
  }
  return <ConciergeDesk />;
}

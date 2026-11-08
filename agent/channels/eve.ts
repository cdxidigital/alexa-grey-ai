import { eveChannel } from "eve/channels/eve";
import { localDev, type AuthFn, vercelOidc } from "eve/channels/auth";
import { auth } from "@/lib/auth";
import { canAccessConcierge } from "@/lib/concierge/access.mjs";

const betterAuthSession: AuthFn<Request> = async (request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  // Signing into Vercel alone does NOT authorise creator business access.
  if (!session || !canAccessConcierge(session.user.id, process.env.ELLIE_ADMIN_USER_IDS)) return null;

  const attributes: Record<string, string> = {
    email: session.user.email,
    name: session.user.name,
  };
  if (session.user.image) attributes.picture = session.user.image;

  return {
    attributes,
    authenticator: "better-auth:ellie-operator",
    principalId: session.user.id,
    principalType: "user",
  };
};

// Project-issued Vercel OIDC and the local development TUI remain infrastructure paths,
// not public browser authorisation. Review tool permissions before production.
export default eveChannel({
  auth: [betterAuthSession, vercelOidc(), localDev()],
});

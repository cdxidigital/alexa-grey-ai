import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessConcierge } from "@/lib/concierge/access.mjs";
import { AgentChat } from "./agent-chat";
import { AccountControl, SignIn } from "./web-chat-auth";

export async function AuthenticatedAgentChat({
  sessionId,
  sessionless,
}: {
  readonly sessionId?: string;
  readonly sessionless?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <SignIn />;
  if (!canAccessConcierge(session.user.id, process.env.ELLIE_ADMIN_USER_IDS)) {
    notFound();
  }

  return (
    <>
      <AgentChat sessionId={sessionId} sessionless={sessionless} />
      <AccountControl
        email={session.user.email}
        image={session.user.image}
        name={session.user.name}
      />
    </>
  );
}

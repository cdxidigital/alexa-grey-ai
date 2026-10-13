import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireStudioUser } from "@/lib/studio/core";
import { SignIn } from "@/app/_components/web-chat-auth";
import { StudioClient } from "./studio-client";

export const metadata = {
  title: "Alexa Grey AI | Likeness Studio",
  description: "Restricted, consent-gated photo and short video production for Alexa Grey AI.",
};

export default async function StudioPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return <SignIn />;

  try {
    await requireStudioUser(new Request("https://studio.local/", { headers: requestHeaders }));
  } catch {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#050505] px-6 text-center text-[#f5f5f0]">
        <h1 className="text-3xl font-medium text-[#d4af37]">Creator access required</h1>
        <p className="max-w-lg text-sm text-white/70">
          This photo and video studio is restricted to Alexa and her specifically authorised operators.
          An authenticated chat account alone does not grant access to creator likeness generation.
        </p>
        <Link className="rounded-full border border-[#d4af37] px-5 py-2 text-sm text-[#d4af37]" href="/">
          Return to chat
        </Link>
      </main>
    );
  }
  return <StudioClient />;
}

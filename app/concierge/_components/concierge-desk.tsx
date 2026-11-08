"use client";

import { useState } from "react";

type Sample = {
  id: string;
  label: string;
  summary: string;
  category: "general" | "media" | "collaboration" | "technical" | "other";
  contact: string;
  purpose: string;
  timeline: string;
  adultAttested: boolean;
  threatOrHarassment?: boolean;
  requestsUnapprovedOffer?: boolean;
};
type Result = {
  disposition: "needs_information" | "qualified_for_human_review" | "human_review" | "safety_review";
  category: string;
  contactValid: boolean;
  flags: string[];
  missing: string[];
  authorizedActions: string[];
  automaticBookingAllowed: boolean;
  automaticPriceQuoteAllowed: boolean;
  recordingAllowed: boolean;
  voiceCloningAllowed: boolean;
};

const SAMPLES: Sample[] = [
  {
    id: "E-001", label: "Brand collaboration", category: "collaboration",
    summary: "A company has supplied a campaign brief, timeline and return contact.",
    contact: "studio@example.org", purpose: "Discuss an upcoming editorial brand campaign",
    timeline: "Next month", adultAttested: true,
  },
  {
    id: "E-002", label: "Incomplete enquiry", category: "general",
    summary: "A general enquiry is missing a way to follow up.",
    contact: "", purpose: "I'd like to ask about a possible project",
    timeline: "Later this month", adultAttested: true,
  },
  {
    id: "E-003", label: "Unapproved quote request", category: "other",
    summary: "A person requests terms that the creator has not authorised.",
    contact: "person@example.org", purpose: "Request details of an unapproved commercial offer",
    timeline: "This week", adultAttested: true, requestsUnapprovedOffer: true,
  },
  {
    id: "E-004", label: "Safety concern", category: "general",
    summary: "A contact includes a threat and must not receive automatic sales follow-up.",
    contact: "other@example.org", purpose: "Send a threatening or harassing message",
    timeline: "Today", adultAttested: true, threatOrHarassment: true,
  },
];

const STATUS: Record<Result["disposition"], { title: string; detail: string; tone: string }> = {
  qualified_for_human_review: {
    title: "Ready for human review", detail: "Complete enough to prepare a human handoff. This is not a verified lead.",
    tone: "border-[#c5a266] text-[#e9ce91]",
  },
  needs_information: {
    title: "More information needed", detail: "The concierge may prepare a brief follow-up for operator approval.",
    tone: "border-[#a5a69e] text-[#e1e1d9]",
  },
  human_review: {
    title: "Creator decision required", detail: "No prices, terms or commitments can be automated.",
    tone: "border-[#d8a477] text-[#f1ca9d]",
  },
  safety_review: {
    title: "Safety escalation", detail: "Do not send commercial drafts. Refer to an authorised human.",
    tone: "border-[#ee938d] text-[#ffc0bb]",
  },
};

function draftFor(status: Result["disposition"]): string | null {
  switch (status) {
    case "qualified_for_human_review":
      return "Thanks for getting in touch. I can pass this through for Ellie to review personally. Nothing is confirmed unless she replies directly.";
    case "needs_information":
      return "Thanks for reaching out. To help me pass this on, could you include a suitable contact method, a quick outline of your enquiry and a preferred timeframe?";
    case "human_review":
      return "Thanks for your message. This needs Ellie’s personal review, so I won’t quote or confirm any terms on her behalf.";
    case "safety_review":
      return null;
  }
}

export function ConciergeDesk() {
  const [selected, setSelected] = useState(SAMPLES[0].id);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sample = SAMPLES.find((item) => item.id === selected) ?? SAMPLES[0];
  const status = result ? STATUS[result.disposition] : null;
  const draft = result ? draftFor(result.disposition) : null;

  async function classify() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/concierge/preview", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ channel: "web", ...sample }),
      });
      if (!response.ok) throw new Error("The private preview is unavailable.");
      const data: { result?: Result } = await response.json();
      if (!data.result) throw new Error("No result returned.");
      setResult(data.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to classify the example.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#080908] px-4 py-10 text-[#eee8dc] sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[#4a4030] pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d7b46a]">fleshsesh · Ellie May</p>
            <span className="rounded-full border border-[#9a793f] px-4 py-2 text-xs font-medium text-[#f2dcae]">PRIVATE SIMULATOR · NOT LIVE</span>
          </div>
          <h1 className="mt-8 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">Your inbox,<br/><em className="text-[#d7b46a]">with a velvet rope.</em></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#d8d1c3]">Review sample enquiries, test screening decisions and inspect drafts. This workspace contains synthetic examples only. No callers, payments, voice cloning or outgoing messages are connected.</p>
        </header>

        <div className="grid gap-7 py-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="inbox-title" className="rounded-2xl border border-[#51432a] bg-[#11120e] p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 id="inbox-title" className="font-serif text-2xl">Sample inbox</h2>
              <span className="text-xs text-[#d7b46a]">4 fictional enquiries</span>
            </div>
            <div className="mt-6 space-y-3">
              {SAMPLES.map((item) => (
                <button
                  key={item.id} type="button" aria-pressed={selected === item.id}
                  onClick={() => { setSelected(item.id); setResult(null); setError(null); }}
                  className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c977] ${selected === item.id ? "border-[#d7b46a] bg-[#30281a]" : "border-[#3f3c34] hover:border-[#aa8854]"}`}
                >
                  <span className="flex justify-between gap-3 text-sm">
                    <strong>{item.label}</strong>
                    <span className="shrink-0 text-[#d7b46a]">{item.id}</span>
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[#c9c3b7]">{item.summary}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={classify} disabled={loading}
              className="mt-6 min-h-12 w-full rounded-lg bg-[#d7b46a] px-5 py-3 font-semibold text-[#14120d] hover:bg-[#f0cd84] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0cd84] disabled:cursor-wait disabled:opacity-60">
              {loading ? "Classifying sample…" : "Classify selected sample"}
            </button>
            <p className="mt-4 text-xs leading-5 text-[#bfb6a5]">Each request is authorised server-side. The demo response contains no raw contact details, and the sample is not saved.</p>
          </section>

          <section aria-labelledby="review-title" className="rounded-2xl border border-[#51432a] bg-[#11120e] p-5 sm:p-7">
            <h2 id="review-title" className="font-serif text-2xl">Concierge review</h2>
            <p className="mt-2 text-sm text-[#c9c3b7]">Deterministic screening, not an AI judgement of legitimacy.</p>
            {error && <div role="alert" className="mt-6 rounded-lg border border-[#cf7373] p-4 text-[#ffbdbd]">{error}</div>}
            {!result && !error && (
              <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#494234] p-7 text-center">
                <span aria-hidden="true" className="text-4xl text-[#d7b46a]">✧</span>
                <p className="mt-4 font-medium">Select an enquiry, then classify it.</p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[#bcb5a9]">See the disposition, missing details, escalation status and a review-only draft.</p>
              </div>
            )}
            {result && status && (
              <div className="mt-7 space-y-6" aria-live="polite">
                <div className={`rounded-xl border p-5 ${status.tone}`}>
                  <p className="text-xs uppercase tracking-widest">Screening outcome</p>
                  <h3 className="mt-2 font-serif text-2xl">{status.title}</h3>
                  <p className="mt-2 text-sm leading-6">{status.detail}</p>
                </div>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-[#bcb5a9]">Category</dt><dd className="mt-1 capitalize">{result.category}</dd></div>
                  <div><dt className="text-[#bcb5a9]">Contact format</dt><dd className="mt-1">{result.contactValid ? "Passes syntax check" : "Missing / invalid"}</dd></div>
                  <div><dt className="text-[#bcb5a9]">Automatic booking</dt><dd className="mt-1">Disabled</dd></div>
                  <div><dt className="text-[#bcb5a9]">Voice cloning</dt><dd className="mt-1">Disabled</dd></div>
                </dl>
                {result.flags.length > 0 && (
                  <div><p className="text-sm font-semibold">Review flags</p>
                    <div className="mt-2 flex flex-wrap gap-2">{result.flags.map(flag => <span key={flag} className="rounded-full border border-[#504737] px-3 py-1 text-xs text-[#f2dcb4]">{flag.replaceAll("_"," ")}</span>)}</div>
                  </div>
                )}
                <div className="border-t border-[#494234] pt-6">
                  <h3 className="font-serif text-xl">Draft response</h3>
                  {draft ? <p className="mt-3 rounded-xl bg-[#242219] p-4 text-sm leading-7 text-[#eee8dc]">{draft}</p>
                    : <p className="mt-3 rounded-xl border border-[#ce7d7d] p-4 text-sm text-[#ffbbbb]">Withheld. Route this enquiry to a human; no automated reply should be prepared.</p>}
                  {draft && <p className="mt-2 text-xs text-[#bcb5a9]">Template only. Not sent, queued or approved by Ellie.</p>}
                </div>
              </div>
            )}
          </section>
        </div>
        <footer className="border-t border-[#4a4030] pt-7 text-sm leading-6 text-[#bdb3a4]">
          <p>Ellie May's approved real voice and public persona require separately documented permission before use. This sandbox has no telephony provider, customer storage or public chat widget.</p>
        </footer>
      </div>
    </main>
  );
}

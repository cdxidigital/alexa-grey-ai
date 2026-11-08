"use client";
import { useState } from "react";

type QueueStatus = "needs_information" | "qualified_for_human_review" |
  "human_review" | "safety_review" | "resolved" | "archived";
type QueueItem = {
  id: string; category: string; channel: string; contact: string;
  purpose: string; timeline: string; flags: string[];
  status: QueueStatus; version: number; expiresAt: string; synthetic: true;
};
const DECISIONS: Record<QueueStatus, QueueStatus[]> = {
  needs_information: ["human_review", "archived"],
  qualified_for_human_review: ["human_review", "archived"],
  human_review: ["needs_information", "resolved", "archived"],
  safety_review: ["archived"],
  resolved: ["archived"], archived: [],
};
const LABELS: Record<QueueStatus, string> = {
  needs_information: "Needs information", qualified_for_human_review: "Ready for review",
  human_review: "In human review", safety_review: "Safety escalation",
  resolved: "Resolved", archived: "Archived",
};
const SAMPLES = ["E-001", "E-002", "E-003", "E-004"] as const;

export function QueuePanel() {
  const [sampleId, setSampleId] = useState<typeof SAMPLES[number]>("E-001");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true); setError(null); setFeedback(null);
    try {
      const response = await fetch("/api/concierge/queue", { cache: "no-store", credentials: "same-origin" });
      if (response.status === 503) {
        setAvailable(false); setItems([]);
        setFeedback("Secure storage is switched off. Configure and verify the private synthetic database before using this queue.");
        return;
      }
      if (!response.ok) throw new Error("Queue access is unavailable.");
      const body: { items: QueueItem[] } = await response.json();
      setAvailable(true); setItems(body.items);
      setFeedback(body.items.length === 0 ? "No saved examples yet." : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the queue.");
    } finally { setBusy(false); }
  }

  async function addSample() {
    setBusy(true); setError(null); setFeedback(null);
    try {
      const response = await fetch("/api/concierge/queue", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sampleId }),
      });
      if (!response.ok) throw new Error("Could not save the fictional enquiry.");
      await refresh();
      setFeedback("Fictional enquiry saved. No message was sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save sample.");
    } finally { setBusy(false); }
  }

  async function decide(item: QueueItem, nextStatus: QueueStatus) {
    if (nextStatus === "archived" && !window.confirm("Archive this fictional enquiry?")) return;
    setBusy(true); setError(null); setFeedback(null);
    try {
      const response = await fetch(`/api/concierge/queue/${encodeURIComponent(item.id)}`, {
        method: "PATCH", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextStatus, expectedVersion: item.version }),
      });
      if (response.status === 409) throw new Error("This entry changed elsewhere. Refresh before deciding.");
      if (!response.ok) throw new Error("Review decision was not saved.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update entry.");
    } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="live-queue-title" className="mt-5 rounded-2xl border border-[#51432a] bg-[#11120e] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d7b46a]">02 / Operator workspace</p>
          <h2 id="live-queue-title" className="mt-3 font-serif text-2xl sm:text-3xl">Encrypted review queue</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d8d1c3]">
            Separate, allowlisted Postgres demonstration. Only four fictional examples are accepted. Status decisions are made by a human operator, never a chatbot.
          </p>
        </div>
        <span className="rounded-full border border-[#79633e] px-3 py-2 text-xs text-[#f0d9a0]">
          {available === null ? "Not checked" : available ? "Synthetic storage ready" : "Storage locked"}
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <button type="button" onClick={refresh} disabled={busy}
          className="min-h-11 rounded-lg border border-[#b09259] px-4 py-2 text-sm font-semibold text-[#f1d9a7] hover:bg-[#292519] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3d18b] disabled:opacity-50">
          {busy ? "Working..." : "Check private queue"}
        </button>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm text-[#eee8dc]">
            <span>Fictional example</span>
            <select value={sampleId} disabled={busy || !available} onChange={e=>setSampleId(e.target.value as typeof sampleId)}
              className="min-h-11 rounded-lg border border-[#827453] bg-[#1c1d16] px-3 py-2 text-[#eee8dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3d18b]">
              {SAMPLES.map(id=><option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <button type="button" disabled={busy || !available} onClick={addSample}
            className="min-h-11 rounded-lg bg-[#d7b46a] px-4 py-2 text-sm font-semibold text-[#17130b] hover:bg-[#efd28e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3d18b] disabled:opacity-50">
            Save sample
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-[#c47b78] px-4 py-3 text-sm text-[#ffc3c0]">{error}</p>}
      {feedback && <p role="status" className="mt-4 text-sm leading-6 text-[#e7cf9c]">{feedback}</p>}
      {available && items.length > 0 && <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map(item=><article key={item.id} className="min-w-0 rounded-xl border border-[#65583c] bg-[#1b1d17] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-[#d7b46a]">{item.category} / {item.channel}</p>
            <span className="rounded-full border border-[#7b6645] px-2 py-1 text-xs">{LABELS[item.status]}</span>
          </div>
          <p className="mt-4 break-words text-sm leading-6 text-[#eee8dc]">{item.purpose}</p>
          <dl className="mt-4 space-y-1 text-xs leading-5 text-[#c9c3b7]">
            <div><dt className="inline font-semibold">Contact: </dt><dd className="inline break-all">{item.contact || "Not supplied"}</dd></div>
            <div><dt className="inline font-semibold">Timeframe: </dt><dd className="inline">{item.timeline}</dd></div>
            <div><dt className="inline font-semibold">Version: </dt><dd className="inline">{item.version}</dd></div>
          </dl>
          {item.flags.length>0 && <p className="mt-3 text-xs leading-5 text-[#f0c8a9]">Flags: {item.flags.join(", ").replaceAll("_"," ")}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {DECISIONS[item.status].map(nextStatus=><button key={nextStatus} type="button" disabled={busy} onClick={()=>decide(item,nextStatus)}
              className="min-h-10 rounded-md border border-[#9a7c48] px-3 py-2 text-xs font-semibold text-[#efd6a2] hover:bg-[#343026] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3d18b] disabled:opacity-50">
              {nextStatus === "archived" ? "Archive" : `Set: ${LABELS[nextStatus]}`}
            </button>)}
          </div>
        </article>)}
      </div>}
      <p className="mt-6 border-t border-[#484331] pt-5 text-xs leading-5 text-[#bfb6a5]">
        No automated outreach, live audio, payment collection or direct customer submissions. The queue uses application-level encryption, requires a database and a private key, and defaults to disabled.
      </p>
    </section>
  );
}

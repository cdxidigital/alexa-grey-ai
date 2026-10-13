"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clapperboard, ImagePlus, Loader2, Play, ShieldCheck, Sparkles, X } from "lucide-react";

type Kind = "photo" | "video";
type Status = "queued" | "running" | "complete" | "failed";
type Job = {
  ticket: string;
  kind: Kind;
  status: Status;
  createdAt: number;
  prompt: string;
  url?: string;
  error?: string;
  rating?: number;
  assetToken?: string;
};
type Reference = { name: string; preview: string; data: string };
type Access = {
  authorised: boolean;
  providerConfigured: boolean;
  creatorConsentRecorded: boolean;
  accuracyMethod: string;
};

const HISTORY_KEY = "alexa-grey-ai:studio-jobs:v1";
const inputClass = "w-full rounded-xl border border-[#d4af37]/25 bg-[#131313] px-4 py-3 text-sm text-[#f5f5f0] outline-none transition-colors focus:border-[#d4af37]";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const initialPhotoPrompt = "A sophisticated black-and-gold fashion editorial portrait with soft studio light and a relaxed confident smile.";
const initialVideoPrompt = "A slow cinematic camera push-in, a natural blink, a gentle head turn and a soft smile; keep the face entirely consistent.";

function readResponse(response: Response): Promise<Record<string, unknown>> {
  return response.json().then((v: unknown) => (v && typeof v === "object" ? v as Record<string, unknown> : {}));
}
function errorOf(data: Record<string, unknown>): string {
  return typeof data.error === "string" ? data.error : "The request could not be completed.";
}

async function compressReference(file: File): Promise<Reference> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
    throw new Error("Select a JPEG, PNG or WebP image smaller than 8 MB.");
  }
  const blobUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to open the selected image."));
      image.src = blobUrl;
    });
    let longest = 1536;
    for (const quality of [0.86, 0.72, 0.58, 0.46]) {
      const scale = Math.min(1, longest / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      if (!canvas.width || !canvas.height) throw new Error("Invalid image dimensions.");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length < 1_700_000) return { name: file.name, preview: data, data };
      longest = Math.max(900, longest - 150);
    }
    throw new Error("Photo is still too large. Select a smaller source image.");
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function StudioClient() {
  const [access, setAccess] = useState<Access | null>(null);
  const [accessError, setAccessError] = useState("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [mode, setMode] = useState<Kind>("photo");
  const [photoPrompt, setPhotoPrompt] = useState(initialPhotoPrompt);
  const [videoPrompt, setVideoPrompt] = useState(initialVideoPrompt);
  const [ratio, setRatio] = useState<"3:4" | "9:16" | "1:1">("3:4");
  const [duration, setDuration] = useState<5 | 10 | 15>(5);
  const [rights, setRights] = useState(false);
  const [costs, setCosts] = useState(false);
  const [history, setHistory] = useState<Job[]>([]);
  const [selected, setSelected] = useState("");
  const [approvedPhoto, setApprovedPhoto] = useState("");
  const [rating, setRating] = useState(90);
  const [busy, setBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/studio/access", { cache: "no-store" });
      const data = await readResponse(response);
      if (!response.ok) setAccessError(errorOf(data));
      else setAccess(data as Access);
    })().catch(() => setAccessError("Could not check studio access."));
    try {
      const restored: unknown = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
      if (Array.isArray(restored)) {
        const jobs = restored.filter((entry): entry is Job =>
          entry && typeof entry === "object" &&
          typeof entry.ticket === "string" &&
          (entry.kind === "photo" || entry.kind === "video") &&
          ["queued", "running", "complete", "failed"].includes(entry.status),
        ).slice(0, 12);
        setHistory(jobs);
        const fromLink = new URLSearchParams(window.location.search).get("ticket");
        if (fromLink && /^[A-Za-z0-9_.-]{30,4000}$/.test(fromLink)) {
          const fromKind = new URLSearchParams(window.location.search).get("kind") === "video" ? "video" : "photo";
          if (!jobs.some((job) => job.ticket === fromLink)) {
            setHistory([{ ticket: fromLink, kind: fromKind, status: "queued", createdAt: Date.now(), prompt: "Requested from Alexa chat" }, ...jobs].slice(0, 12));
          }
          setSelected(fromLink);
        } else if (jobs[0]) setSelected(jobs[0].ticket);
      }
    } catch {
      // A malformed storage entry must not block access to the studio.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
    } catch {
      // Quotas/private mode may disable storage. Current session still works.
    }
  }, [history, ready]);

  useEffect(() => {
    const pending = history.filter((job) => job.status === "queued" || job.status === "running");
    if (pending.length === 0) return;
    let stopped = false;
    const refresh = async () => {
      await Promise.all(pending.map(async (job) => {
        try {
          const response = await fetch("/api/studio/jobs?ticket=" + encodeURIComponent(job.ticket), { cache: "no-store" });
          const data = await readResponse(response);
          if (stopped) return;
          if (!response.ok) {
            setHistory((items) => items.map((entry) => entry.ticket === job.ticket
              ? { ...entry, status: "failed", error: errorOf(data) } : entry));
            return;
          }
          const status = data.status as Status;
          if (!["queued", "running", "complete", "failed"].includes(status)) return;
          setHistory((items) => items.map((entry) => entry.ticket === job.ticket ? {
            ...entry,
            status,
            url: typeof data.url === "string" ? data.url : entry.url,
            error: typeof data.reason === "string" ? data.reason : undefined,
          } : entry));
        } catch {
          // The next poll will retry temporary connectivity failures.
        }
      }));
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => { stopped = true; window.clearInterval(interval); };
  }, [history.map((job) => job.ticket + ":" + job.status).join("|")]);

  const chosen = useMemo(() => history.find((job) => job.ticket === selected), [history, selected]);
  const approvedPhotos = history.filter((job) => job.kind === "photo" && job.assetToken && job.status === "complete");
  const canRun = Boolean(access?.providerConfigured && access?.creatorConsentRecorded && rights && costs);
  const activePhoto = approvedPhotos.find((job) => job.ticket === approvedPhoto) || approvedPhotos[0];

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setMessage("");
    try {
      const batch = Array.from(files).slice(0, Math.max(0, 3 - references.length));
      const compressed = await Promise.all(batch.map(compressReference));
      setReferences((current) => [...current, ...compressed].slice(0, 3));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load reference photo.");
    }
  }

  async function generate() {
    if (busy || !canRun) return;
    setBusy(true);
    setMessage("");
    try {
      const body = mode === "photo"
        ? {
            kind: "photo", prompt: photoPrompt, references: references.map((item) => item.data),
            aspectRatio: ratio, rightsAcknowledged: rights, costsAcknowledged: costs,
          }
        : {
            kind: "video", prompt: videoPrompt, approvedPhotoToken: activePhoto?.assetToken || "",
            duration, rightsAcknowledged: rights, costsAcknowledged: costs,
          };
      const response = await fetch("/api/studio/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await readResponse(response);
      if (!response.ok || typeof data.ticket !== "string") throw new Error(errorOf(data));
      const job: Job = {
        ticket: data.ticket,
        kind: mode,
        status: "queued",
        createdAt: Date.now(),
        prompt: mode === "photo" ? photoPrompt : videoPrompt,
      };
      setHistory((items) => [job, ...items].slice(0, 12));
      setSelected(job.ticket);
      setRating(90);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not queue generation.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!chosen || chosen.status !== "complete" || !chosen.url || rating < 98 || reviewBusy) return;
    setReviewBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/studio/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: chosen.ticket, likenessRating: rating, approved: true, rightsAcknowledged: rights }),
      });
      const data = await readResponse(response);
      if (!response.ok || typeof data.assetToken !== "string") throw new Error(errorOf(data));
      setHistory((items) => items.map((job) => job.ticket === chosen.ticket
        ? { ...job, assetToken: data.assetToken as string, rating } : job));
      if (chosen.kind === "photo") setApprovedPhoto(chosen.ticket);
      setMessage("Creator review recorded for this session. The asset can now be used for an approved video.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not approve asset.");
    } finally {
      setReviewBusy(false);
    }
  }

  function animate(job: Job) {
    setApprovedPhoto(job.ticket);
    setMode("video");
    setSelected(job.ticket);
    setRating(90);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-[#050505] text-[#f5f5f0]">
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 md:px-10 md:py-12">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d4af37]/20 pb-6">
          <div>
            <Link className="mb-5 inline-flex items-center gap-2 text-xs text-[#eed891]/80 hover:text-[#eed891]" href="/">
              <ArrowLeft size={14} /> Back to Alexa chat
            </Link>
            <p className="text-xs uppercase tracking-[.26em] text-[#d4af37]">Alexa Grey AI · Creator-only</p>
            <h1 className="mt-2 font-serif text-4xl font-light text-[#eed891] md:text-6xl">Likeness Studio</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Create reference-guided glamour photos, then animate the ones Alexa approves. No likeness percentage is guaranteed by a model.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/25 px-3 py-2 text-xs text-[#eed891]">
            <ShieldCheck size={14} /> Private creator controls
          </span>
        </header>

        {(accessError || !access?.providerConfigured || !access?.creatorConsentRecorded) && (
          <div role="status" className="rounded-2xl border border-amber-600/40 bg-amber-950/20 px-5 py-4 text-sm text-amber-100">
            {accessError || (!access ? "Checking studio access…" : !access.creatorConsentRecorded
              ? "Studio locked: creator adulthood verification and explicit, recorded likeness consent must be configured by the operator."
              : "Studio locked: provider API credentials are not configured.")}
          </div>
        )}

        <section className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0f0f0f] p-5 md:p-7">
              <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Media format">
                <button type="button" role="tab" aria-selected={mode === "photo"} onClick={() => setMode("photo")}
                  className={buttonClass + (mode === "photo" ? " bg-[#d4af37] text-black" : " bg-white/5 text-white/80 hover:bg-white/10")}>
                  <ImagePlus size={17} /> Photos
                </button>
                <button type="button" role="tab" aria-selected={mode === "video"} onClick={() => setMode("video")}
                  className={buttonClass + (mode === "video" ? " bg-[#d4af37] text-black" : " bg-white/5 text-white/80 hover:bg-white/10")}>
                  <Clapperboard size={17} /> Short videos
                </button>
              </div>

              {mode === "photo" ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-medium">1. Upload authorised reference portraits</h2>
                    <p className="mt-1 text-sm text-white/60">
                      Upload 1–3 authentic, creator-approved, non-explicit photographs. Different angles improve review quality.
                      References stay in this browser tab until you submit them for processing by fal.ai.
                    </p>
                    <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#d4af37]/40 bg-[#0a0a0a] px-4 py-5 text-center text-sm text-[#eed891] hover:bg-[#d4af37]/5">
                      <ImagePlus size={23} /> Choose reference images (up to 3)
                      <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only"
                        onChange={(event) => { void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }}/>
                    </label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {references.map((item, index) => (
                        <div key={index} className="relative h-28 w-24 overflow-hidden rounded-xl border border-white/15 bg-black">
                          <img src={item.preview} alt={"Reference " + (index + 1)} className="h-full w-full object-cover"/>
                          <button type="button" aria-label={"Remove reference " + (index + 1)}
                            className="absolute right-1 top-1 rounded-full bg-black/80 p-1 text-white"
                            onClick={() => setReferences((old) => old.filter((_, i) => i !== index))}>
                            <X size={13}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="photo-brief" className="mb-2 block text-sm text-[#eed891]">2. Describe the editorial photograph</label>
                    <textarea id="photo-brief" className={inputClass + " min-h-28 resize-y"} maxLength={900}
                      value={photoPrompt} onChange={(event) => setPhotoPrompt(event.target.value)}/>
                  </div>
                  <div>
                    <label htmlFor="ratio" className="mb-2 block text-sm text-[#eed891]">Composition</label>
                    <select id="ratio" className={inputClass} value={ratio}
                      onChange={(event) => setRatio(event.target.value as "3:4" | "9:16" | "1:1")}>
                      <option value="3:4">3:4 portrait</option>
                      <option value="9:16">9:16 story / Reel</option>
                      <option value="1:1">1:1 square</option>
                    </select>
                    <p className="mt-2 text-xs text-white/50">2K reference-guided editing · one image per job</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <h2 className="text-lg font-medium">Animate an approved Alexa portrait</h2>
                  <p className="text-sm text-white/60">
                    Videos begin from an approved AI photo. This reduces identity drift, although facial changes are still possible and each finished clip needs its own review.
                  </p>
                  <div>
                    <label htmlFor="approved-photo" className="mb-2 block text-sm text-[#eed891]">Starting frame</label>
                    <select id="approved-photo" className={inputClass} value={activePhoto?.ticket || ""}
                      onChange={(event) => setApprovedPhoto(event.target.value)} disabled={approvedPhotos.length === 0}>
                      {approvedPhotos.length === 0 && <option value="">First approve a generated photo</option>}
                      {approvedPhotos.map((job, i) => <option key={job.ticket} value={job.ticket}>Approved portrait {i + 1} · {job.rating}% creator review</option>)}
                    </select>
                  </div>
                  {activePhoto?.url && <img src={activePhoto.url} alt="Approved first frame" className="max-h-64 rounded-xl object-contain"/>}
                  <div>
                    <label htmlFor="video-brief" className="mb-2 block text-sm text-[#eed891]">Movement and camera direction</label>
                    <textarea id="video-brief" className={inputClass + " min-h-28 resize-y"} maxLength={900}
                      value={videoPrompt} onChange={(event) => setVideoPrompt(event.target.value)}/>
                  </div>
                  <div>
                    <label htmlFor="duration" className="mb-2 block text-sm text-[#eed891]">Video length</label>
                    <select id="duration" className={inputClass} value={duration}
                      onChange={(event) => setDuration(Number(event.target.value) as 5 | 10 | 15)}>
                      <option value={5}>5 seconds</option>
                      <option value={10}>10 seconds</option>
                      <option value={15}>15 seconds</option>
                    </select>
                    <p className="mt-2 text-xs text-white/50">Kling V3 Pro · silent video by default · provider charges vary with length</p>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3 border-t border-[#d4af37]/15 pt-5">
                <label className="flex items-start gap-3 text-xs leading-5 text-white/70">
                  <input className="mt-1 accent-[#d4af37]" type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)}/>
                  I confirm Alexa is an adult who has expressly authorised this likeness use, the reference photos are lawful and non-explicit, and third-party processing is permitted.
                </label>
                <label className="flex items-start gap-3 text-xs leading-5 text-white/70">
                  <input className="mt-1 accent-[#d4af37]" type="checkbox" checked={costs} onChange={(event) => setCosts(event.target.checked)}/>
                  I understand provider usage incurs charges and generated/reference media may have provider-hosted URLs; this prototype does not provide a private asset vault.
                </label>
                <button type="button" onClick={() => void generate()}
                  disabled={busy || !canRun || (mode === "photo" ? references.length === 0 : !activePhoto?.assetToken)}
                  className={buttonClass + " mt-3 w-full bg-[#d4af37] text-black hover:bg-[#eed891]"}>
                  {busy ? <Loader2 size={17} className="animate-spin"/> : <Sparkles size={17}/>}
                  {busy ? "Submitting to provider…" : mode === "photo" ? "Generate Alexa photo" : "Generate short video"}
                </button>
                {message && <p role="status" className="rounded-lg bg-white/5 px-3 py-2 text-sm text-[#eed891]">{message}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-[#d4af37]/15 bg-[#0c0c0c] p-5 text-sm leading-6 text-white/70">
              <p className="font-medium text-[#eed891]">About the 98–100% likeness target</p>
              <p className="mt-2">
                Review both the original references and each output side by side. The slider is a creator-reported judgement, not a biometric score.
                No generation model can guarantee 98–100% identity fidelity. Reject anything that does not look unmistakably like Alexa.
              </p>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0f0f0f] p-5 md:p-7">
              <h2 className="text-lg font-medium text-[#eed891]">Production queue</h2>
              <p className="mt-1 text-xs text-white/50">Status polls from the provider. Jobs in this tab are remembered only for this browser session.</p>
              {history.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-white/20 px-4 py-12 text-center text-sm text-white/50">
                  No photos or videos yet. Upload approved references to begin.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {history.map((job) => (
                    <button type="button" key={job.ticket} onClick={() => {setSelected(job.ticket); setRating(job.rating || 90);}}
                      className={"flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm " +
                        (selected === job.ticket ? "border-[#d4af37] bg-[#d4af37]/10" : "border-white/10 bg-black/30 hover:border-[#d4af37]/30")}>
                      <span className="flex items-center gap-2">{job.kind === "photo" ? <ImagePlus size={16}/> : <Play size={16}/>}
                        {job.kind === "photo" ? "Photo" : "Video"} · {new Date(job.createdAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={"text-xs " + (job.status === "complete" ? "text-green-300" : "text-white/60")}>
                        {job.assetToken ? "Approved" : job.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {chosen && (
                <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Selected {chosen.kind}</h3>
                    <span className="text-xs uppercase tracking-widest text-[#d4af37]">{chosen.status}</span>
                  </div>
                  {(chosen.status === "queued" || chosen.status === "running") &&
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 p-4 text-sm text-white/70">
                      <Loader2 size={17} className="animate-spin"/> The model is processing your request…
                    </div>}
                  {chosen.error && <p role="alert" className="text-sm text-red-300">{chosen.error}</p>}
                  {chosen.status === "complete" && chosen.url && (
                    <>
                      {chosen.kind === "photo"
                        ? <img className="max-h-[480px] w-full rounded-xl bg-black object-contain" src={chosen.url} alt="AI-generated Alexa likeness candidate"/>
                        : <video controls playsInline className="w-full rounded-xl bg-black" src={chosen.url}/>}
                      <a className="block rounded-xl border border-[#d4af37]/40 px-4 py-3 text-center text-sm text-[#eed891] hover:bg-[#d4af37]/10"
                        href={chosen.url} target="_blank" rel="noopener noreferrer">Open full-resolution {chosen.kind}</a>
                      {chosen.assetToken ? (
                        <div className="flex items-center gap-2 rounded-lg bg-green-950/30 p-3 text-sm text-green-200">
                          <CheckCircle2 size={18}/> Approved for this session at {chosen.rating}% creator-rated likeness.
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-[#d4af37]/25 p-4">
                          <h4 className="text-sm font-medium text-[#eed891]">Creator likeness review</h4>
                          <p className="text-xs leading-5 text-white/60">
                            Compare against Alexa's authentic portraits. Select your subjective likeness estimate. 98–100 is a release target, not model-measured accuracy.
                          </p>
                          <label htmlFor="likeness-review" className="flex justify-between text-sm">
                            <span>Creator estimate</span><span>{rating}%</span>
                          </label>
                          <input id="likeness-review" type="range" min={0} max={100} value={rating}
                            onChange={(event) => setRating(Number(event.target.value))} className="w-full accent-[#d4af37]"/>
                          <button type="button" disabled={rating < 98 || reviewBusy || !rights}
                            onClick={() => void approve()} className={buttonClass + " w-full bg-[#d4af37] text-black hover:bg-[#eed891]"}>
                            {reviewBusy ? "Recording approval…" : "Approve likeness (98–100%)"}
                          </button>
                          <button type="button" className={buttonClass + " w-full border border-white/20 text-white/80 hover:bg-white/10"}
                            onClick={() => {setMode(chosen.kind);setRating(90);setMessage("Rejected. Adjust your brief or references and generate a new candidate.");}}>
                            Reject and revise
                          </button>
                        </div>
                      )}
                      {chosen.kind === "photo" && chosen.assetToken && (
                        <div className="space-y-2">
                          <button type="button" className={buttonClass + " w-full bg-[#d4af37] text-black"}
                            onClick={() => animate(chosen)}><Clapperboard size={16}/> Animate this approved photo</button>
                          <button type="button" className={buttonClass + " w-full border border-white/20 text-white/80"}
                            onClick={() => {
                              if (chosen.assetToken) {
                                void navigator.clipboard.writeText(chosen.assetToken)
                                  .then(() => setMessage("Approval token copied. Give it to Alexa AI privately when requesting a new video."))
                                  .catch(() => setMessage("Clipboard unavailable. Use the Animate button instead."));
                              }
                            }}>
                            Copy creator approval code for AI chat
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </section>

        <footer className="border-t border-[#d4af37]/10 pt-5 text-xs leading-5 text-white/50">
          AI-generated likeness content requires adult creator consent, individual review and appropriate disclosure. No posts are published by this studio.
          Third-party generation and output URLs are subject to provider retention and access terms. Current work is a consent-gated integration, not an independently measured 98% facial match.
        </footer>
      </div>
    </main>
  );
}

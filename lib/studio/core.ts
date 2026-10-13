import { createHmac, timingSafeEqual } from "node:crypto";
import { auth } from "../auth";

export const PHOTO_MODEL = "google/nano-banana-2.1/edit";
export const VIDEO_MODEL = "fal-ai/kling-video/v3/pro/image-to-video";
export type StudioKind = "photo" | "video";
export type StudioModel = typeof PHOTO_MODEL | typeof VIDEO_MODEL;

type JobTicket = {
  v: 1;
  type: "job";
  owner: string;
  kind: StudioKind;
  model: StudioModel;
  requestId: string;
  expires: number;
};

type AssetTicket = {
  v: 1;
  type: "asset";
  owner: string;
  url: string;
  kind: StudioKind;
  reviewedLikeness: number;
  expires: number;
};

const TICKET_LIFETIME_MS = 12 * 60 * 60 * 1000;
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const REQUEST_ID = /^[a-f0-9-]{16,80}$/i;
const FORBIDDEN_TERMS = /\b(nude|naked|topless|genital|porn|explicit sex|sex act|penetration|masturbat|fetish scene)\b/i;

export class StudioError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "StudioError";
  }
}

export function studioEnabled(): boolean {
  return Boolean(process.env.FAL_KEY);
}

export function creatorConsentRecorded(): boolean {
  return Boolean(
    process.env.ALEXA_LIKENESS_CONSENT_RECORD_ID?.trim() &&
    process.env.ALEXA_CREATOR_ADULT_VERIFIED === "true"
  );
}

function isEmailAllowed(email: string): boolean {
  const list = (process.env.ALEXA_STUDIO_ALLOWED_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 && list.includes(email.trim().toLowerCase());
}

export async function requireStudioUser(request: Request): Promise<{ id: string; email: string }> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id || !session.user.email || !isEmailAllowed(session.user.email)) {
    throw new StudioError("Creator studio access requires an authorised account.", 403);
  }
  return { id: session.user.id, email: session.user.email };
}

// Eve tools have their own verified principal. Do not trust any role or email
// that arrives as a prompt/tool argument.
export function requireStudioPrincipal(
  principal: { principalId?: string; principalType?: string; authenticator?: string; attributes?: Record<string, string> } | null | undefined
): { id: string; email: string } {
  const email = principal?.attributes?.email;
  if (principal?.principalType !== "user" || principal.authenticator !== "better-auth:vercel" || !principal.principalId || !email || !isEmailAllowed(email)) {
    throw new StudioError("Only an authenticated, allowlisted creator may invoke image or video generation.", 403);
  }
  return { id: principal.principalId, email };
}

export function requireStudioConfigured(): void {
  if (!creatorConsentRecorded()) {
    throw new StudioError("Creator adulthood and explicit likeness consent must be recorded before generation.", 423);
  }
  if (!studioEnabled()) {
    throw new StudioError("Add a server-side FAL_KEY before starting paid generations.", 503);
  }
  if (!process.env.STUDIO_SIGNING_SECRET && !process.env.BETTER_AUTH_SECRET) {
    throw new StudioError("Server-side studio signing secret is not configured.", 503);
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    // A non-browser client still has to authenticate; browser requests include Origin.
    return;
  }
  try {
    const a = new URL(origin);
    const b = new URL(request.url);
    if (a.protocol !== b.protocol || a.host !== b.host) {
      throw new Error("cross origin");
    }
  } catch {
    throw new StudioError("Cross-origin studio requests are not allowed.", 403);
  }
}

function signingKey(): string {
  const key = process.env.STUDIO_SIGNING_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!key || key.length < 24) {
    throw new StudioError("Configure a strong studio signing secret.", 503);
  }
  return key;
}

function sign<T extends JobTicket | AssetTicket>(payload: T): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return body + "." + mac;
}

function verify(token: string): Record<string, unknown> {
  if (token.length > 4000 || !/^[A-Za-z0-9_.-]+$/.test(token)) {
    throw new StudioError("Malformed studio token.", 403);
  }
  const parts = token.split(".");
  if (parts.length !== 2) throw new StudioError("Malformed studio token.", 403);
  const mac = createHmac("sha256", signingKey()).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], "base64url");
  if (supplied.length !== mac.length || !timingSafeEqual(supplied, mac)) {
    throw new StudioError("Invalid studio token.", 403);
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new StudioError("Invalid studio token.", 403);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new StudioError("Invalid studio token.", 403);
  }
  const record = data as Record<string, unknown>;
  if (record.v !== 1 || typeof record.expires !== "number" || record.expires < Date.now()) {
    throw new StudioError("Studio token has expired.", 403);
  }
  return record;
}

export function createJobTicket(owner: string, kind: StudioKind, requestId: string): string {
  if (!REQUEST_ID.test(requestId)) throw new StudioError("Provider returned an invalid job identifier.", 502);
  const model = kind === "photo" ? PHOTO_MODEL : VIDEO_MODEL;
  return sign({ v: 1, type: "job", owner, kind, model, requestId, expires: Date.now() + TICKET_LIFETIME_MS });
}

export function readJobTicket(token: string, owner: string): JobTicket {
  const value = verify(token);
  if (value.type !== "job" || value.owner !== owner ||
      (value.kind !== "photo" && value.kind !== "video") ||
      (value.model !== PHOTO_MODEL && value.model !== VIDEO_MODEL) ||
      (value.kind === "photo" && value.model !== PHOTO_MODEL) ||
      (value.kind === "video" && value.model !== VIDEO_MODEL) ||
      typeof value.requestId !== "string" || !REQUEST_ID.test(value.requestId)) {
    throw new StudioError("This generation job is not accessible to this account.", 403);
  }
  return value as JobTicket;
}

export function createAssetTicket(owner: string, kind: StudioKind, url: string, reviewedLikeness: number): string {
  if (!isProviderAssetUrl(url) || reviewedLikeness < 98 || reviewedLikeness > 100) {
    throw new StudioError("Only creator-reviewed assets meeting the chosen likeness threshold may be approved.");
  }
  return sign({
    v: 1, type: "asset", owner, kind, url, reviewedLikeness,
    expires: Date.now() + TICKET_LIFETIME_MS,
  });
}

export function readAssetTicket(token: string, owner: string): AssetTicket {
  const value = verify(token);
  if (value.type !== "asset" || value.owner !== owner ||
      (value.kind !== "photo" && value.kind !== "video") ||
      typeof value.url !== "string" || !isProviderAssetUrl(value.url) ||
      typeof value.reviewedLikeness !== "number" || value.reviewedLikeness < 98) {
    throw new StudioError("This media asset is not approved for reuse.", 403);
  }
  return value as AssetTicket;
}

export function isProviderAssetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return hostname === "fal.media" || hostname.endsWith(".fal.media") ||
      (hostname === "storage.googleapis.com" && url.pathname.startsWith("/falserverless/"));
  } catch {
    return false;
  }
}

export function validatePrompt(prompt: unknown): string {
  if (typeof prompt !== "string" || prompt.trim().length < 12 || prompt.trim().length > 900) {
    throw new StudioError("Enter a creative prompt between 12 and 900 characters.");
  }
  if (FORBIDDEN_TERMS.test(prompt)) {
    throw new StudioError("The Alexa likeness studio only supports non-explicit image and video content.");
  }
  return prompt.trim();
}

export function validateReference(data: unknown): string {
  if (typeof data !== "string" || data.length > 1_700_000) {
    throw new StudioError("Each compressed reference image must be under 1.2 MB.");
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(data);
  if (!match || !ALLOWED_IMAGE_MIME.has(match[1].toLowerCase())) {
    throw new StudioError("Only JPEG, PNG or WebP reference images are accepted.");
  }
  const image = Buffer.from(match[2], "base64");
  if (image.length < 512 || image.length > 1_250_000) {
    throw new StudioError("Image is empty or exceeds the safe upload limit.");
  }
  const jpg = image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const png = image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = image.subarray(0, 4).toString() === "RIFF" && image.subarray(8, 12).toString() === "WEBP";
  const mime = match[1].toLowerCase();
  if ((mime === "image/jpeg" && !jpg) || (mime === "image/png" && !png) || (mime === "image/webp" && !webp)) {
    throw new StudioError("Image file signature does not match its format.");
  }
  return data;
}

export function photoInput(prompt: string, references: string[], aspectRatio: "3:4" | "9:16" | "1:1") {
  return {
    prompt: [
      "Create one photorealistic, fully clothed non-explicit editorial photograph of the SAME ADULT WOMAN shown in the supplied authenticated references.",
      "Preserve the original identity closely: eye shape and placement, brow structure, nose bridge, lips, skin tone, facial geometry, hairline, and age. Do not beautify into a different person. No face morphing.",
      "Change only scene, styling, lighting and framing as described. Natural anatomy, real skin texture, photographic optics, two hands only, no extra people.",
      "Luxury fashion photography with subtle black-and-gold Alexa Grey brand direction where appropriate.",
      "SCENE AND CREATIVE BRIEF: " + prompt,
    ].join("\n"),
    image_urls: references,
    num_images: 1,
    aspect_ratio: aspectRatio,
    resolution: "2K",
    output_format: "png",
    thinking_level: "high",
    limit_generations: true,
    enable_web_search: false,
    safety_tolerance: "2",
  };
}

export function videoInput(prompt: string, startImageUrl: string, duration: 5 | 10 | 15, references: string[] = []) {
  const identityElements = references.length > 0 ? [{
    frontal_image_url: references[0],
    reference_image_urls: references.slice(1),
  }] : [];
  return {
    prompt: [
      "Faithfully animate the woman in the supplied FIRST FRAME. Preserve her facial identity, hairline, eye shape, proportions and outfit throughout.",
      ...(identityElements.length ? ["The same creator appears as @Element1; keep the provided identity reference consistent throughout the clip."] : []),
      "Small natural movements: subtle breathing, natural blinks, realistic head turns and soft expressions. No identity drift, extra people, face swaps or body distortions.",
      "Tasteful, fully clothed, non-explicit luxury fashion video.",
      "MOTION AND CAMERA: " + prompt,
    ].join("\n"),
    start_image_url: startImageUrl,
    duration: String(duration),
    generate_audio: false,
    ...(identityElements.length ? { elements: identityElements } : {}),
    negative_prompt: "facial morphing, identity drift, extra fingers, warped anatomy, erotic content, low quality, distortion",
  };
}

async function falFetch(path: string, method = "GET", input?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = process.env.FAL_KEY;
  if (!key) throw new StudioError("fal.ai is not configured.", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch("https://queue.fal.run/" + path, {
      method,
      headers: { Authorization: "Key " + key, ...(input ? { "Content-Type": "application/json" } : {}) },
      body: input ? JSON.stringify(input) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object" || Array.isArray(data)) {
      throw new StudioError("Generation provider returned " + response.status + ". Check configuration, limits and provider status.", 502);
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError("The media provider is currently unreachable. Please retry later.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function queueMedia(kind: StudioKind, input: Record<string, unknown>): Promise<string> {
  requireStudioConfigured();
  const model = kind === "photo" ? PHOTO_MODEL : VIDEO_MODEL;
  const result = await falFetch(model, "POST", input);
  if (typeof result.request_id !== "string") {
    throw new StudioError("Media provider did not return a generation job.", 502);
  }
  return result.request_id;
}

function mediaUrl(result: Record<string, unknown>, kind: StudioKind): string | null {
  const payload = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : result;
  let url: unknown;
  if (kind === "photo") {
    const images = payload.images;
    url = Array.isArray(images) && images.length > 0 && images[0] && typeof images[0] === "object"
      ? (images[0] as Record<string, unknown>).url : null;
  } else {
    const video = payload.video;
    url = video && typeof video === "object" ? (video as Record<string, unknown>).url : null;
  }
  return typeof url === "string" && isProviderAssetUrl(url) ? url : null;
}

export async function getMediaJob(ticket: JobTicket): Promise<{
  status: "queued" | "running" | "complete" | "failed";
  url?: string;
  reason?: string;
}> {
  const path = ticket.model + "/requests/" + ticket.requestId;
  const status = await falFetch(path + "/status");
  const state = status.status;
  if (state === "IN_QUEUE") return { status: "queued" };
  if (state === "IN_PROGRESS") return { status: "running" };
  if (state === "FAILED" || state === "CANCELLED") return { status: "failed", reason: "Provider reported a failed or cancelled job." };
  if (state !== "COMPLETED") return { status: "running" };
  const result = await falFetch(path);
  const url = mediaUrl(result, ticket.kind);
  if (!url) return { status: "failed", reason: "Provider completed without a supported media file." };
  return { status: "complete", url };
}

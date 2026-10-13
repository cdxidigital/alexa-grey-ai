import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createJobTicket, getMediaJob, photoInput, queueMedia, readAssetTicket,
  readJobTicket, requireSameOrigin, requireStudioConfigured, requireStudioUser,
  StudioError, validatePrompt, validateReference, videoInput,
} from "@/lib/studio/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const photoSchema = z.object({
  kind: z.literal("photo"),
  prompt: z.string(),
  references: z.array(z.string()).min(1).max(3),
  aspectRatio: z.enum(["3:4", "9:16", "1:1"]).default("3:4"),
  rightsAcknowledged: z.literal(true),
  costsAcknowledged: z.literal(true),
});
const videoSchema = z.object({
  kind: z.literal("video"),
  prompt: z.string(),
  approvedPhotoToken: z.string().min(20),
  duration: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  rightsAcknowledged: z.literal(true),
  costsAcknowledged: z.literal(true),
});
const requestSchema = z.discriminatedUnion("kind", [photoSchema, videoSchema]);

function fail(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid media request. Check your references, duration and confirmations." }, { status: 400 });
  }
  console.error("Studio job error", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ error: "Unable to process this studio request." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireStudioUser(request);
    requireStudioConfigured();
    if (Number(request.headers.get("content-length") || "0") > 4_000_000) {
      throw new StudioError("Upload is too large. Please use compressed reference photos.", 413);
    }
    const text = await request.text();
    if (text.length > 4_000_000) throw new StudioError("Upload is too large.", 413);
    const parsed = requestSchema.parse(JSON.parse(text));
    const prompt = validatePrompt(parsed.prompt);
    let input: Record<string, unknown>;
    if (parsed.kind === "photo") {
      input = photoInput(prompt, parsed.references.map(validateReference), parsed.aspectRatio);
    } else {
      const asset = readAssetTicket(parsed.approvedPhotoToken, user.id);
      if (asset.kind !== "photo") throw new StudioError("Video creation requires an approved photo first.", 403);
      input = videoInput(prompt, asset.url, parsed.duration);
    }
    const requestId = await queueMedia(parsed.kind, input);
    return NextResponse.json(
      { ticket: createJobTicket(user.id, parsed.kind, requestId), kind: parsed.kind, status: "queued" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireStudioUser(request);
    requireStudioConfigured();
    const ticket = new URL(request.url).searchParams.get("ticket");
    if (!ticket) throw new StudioError("Missing generation ticket.");
    const job = readJobTicket(ticket, user.id);
    const result = await getMediaJob(job);
    return NextResponse.json({ kind: job.kind, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

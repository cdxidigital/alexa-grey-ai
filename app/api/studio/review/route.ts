import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAssetTicket, getMediaJob, readJobTicket, requireSameOrigin,
  requireStudioConfigured, requireStudioUser, StudioError,
} from "@/lib/studio/core";

export const runtime = "nodejs";
const schema = z.object({
  ticket: z.string().min(20).max(4000),
  likenessRating: z.number().int().min(98).max(100),
  approved: z.literal(true),
  rightsAcknowledged: z.literal(true),
});

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireStudioUser(request);
    requireStudioConfigured();
    const data = schema.parse(await request.json());
    const ticket = readJobTicket(data.ticket, user.id);
    const result = await getMediaJob(ticket);
    if (result.status !== "complete" || !result.url) {
      throw new StudioError("Generation must complete before likeness approval.", 409);
    }
    // Rating is the creator's subjective review, not a biometric similarity metric.
    const assetToken = createAssetTicket(user.id, ticket.kind, result.url, data.likenessRating);
    return NextResponse.json({
      approved: true, kind: ticket.kind, likenessRating: data.likenessRating,
      ratingMethod: "creator_subjective_review",
      assetToken,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "A creator review between 98 and 100 is required." }, { status: 400 });
    }
    console.error("Studio review failure", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Review could not be completed." }, { status: 500 });
  }
}

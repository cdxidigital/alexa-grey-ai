import { NextResponse } from "next/server";
import {
  creatorConsentRecorded, requireStudioUser, studioEnabled, StudioError,
} from "@/lib/studio/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStudioUser(request);
    return NextResponse.json({
      authorised: true,
      providerConfigured: studioEnabled(),
      creatorConsentRecorded: creatorConsentRecorded(),
      supports: ["photo", "video"],
      accuracyMethod: "human likeness review; no unverified automated percentage",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof StudioError ? error.message : "Studio access unavailable.",
    }, { status: error instanceof StudioError ? error.status : 500 });
  }
}

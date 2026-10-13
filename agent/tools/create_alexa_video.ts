import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import {
  createJobTicket, queueMedia, readAssetTicket, requireStudioConfigured,
  requireStudioPrincipal, StudioError, validatePrompt, videoInput,
} from "../../lib/studio/core";

export default defineTool({
  description: "Generate a paid 5-15 second silent, non-explicit video of the creator-authorised Alexa Grey AI likeness from a previously reviewed and approved photo. The caller must be authenticated as an allowlisted creator and provide that photo's signed approval token from the studio. Requires human approval and may incur video inference costs.",
  approval: always(),
  inputSchema: z.object({
    prompt: z.string().min(12).max(900).describe("Subtle facial movement and camera direction; avoid aggressive motion to preserve identity."),
    approvedPhotoToken: z.string().min(20).describe("Signed asset token from an Alexa creator-reviewed photo, not a public URL."),
    duration: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5),
  }),
  async execute(input, ctx) {
    const creator = requireStudioPrincipal(ctx.session.auth.current);
    requireStudioConfigured();
    const asset = readAssetTicket(input.approvedPhotoToken, creator.id);
    if (asset.kind !== "photo") throw new StudioError("Video generation requires an approved photo first.", 403);
    const refs = (process.env.ALEXA_APPROVED_REFERENCE_URLS || "")
      .split(",").map((url) => url.trim()).filter(Boolean);
    const usableRefs = refs.length > 0 && refs.length <= 3 &&
      refs.every((url) => { try { return new URL(url).protocol === "https:"; } catch { return false; } })
      ? refs : [];
    const requestId = await queueMedia(
      "video", videoInput(validatePrompt(input.prompt), asset.url, input.duration, usableRefs)
    );
    const ticket = createJobTicket(creator.id, "video", requestId);
    return {
      status: "queued",
      kind: "video",
      studioLink: "/studio?kind=video&ticket=" + encodeURIComponent(ticket),
      message: "Video job queued. Review the result frame-by-frame for likeness drift in the creator studio. No publishing occurs automatically.",
    };
  },
});

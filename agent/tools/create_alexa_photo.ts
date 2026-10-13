import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import {
  createJobTicket, photoInput, queueMedia, requireStudioConfigured,
  requireStudioPrincipal, StudioError, validatePrompt,
} from "../../lib/studio/core";

export default defineTool({
  description: "Start a paid, non-explicit Alexa Grey likeness PHOTO generation for an authorised creator only, using preapproved server-configured reference images. Requires human approval before starting. If reference URLs are not configured, tell the creator to use /studio and upload authentic approved portraits. Generated outputs require creator likeness review; 98-100% is a goal, not a guarantee.",
  approval: always(),
  inputSchema: z.object({
    prompt: z.string().min(12).max(900).describe("Scene, outfit, lighting and composition for a fully clothed glamour photo."),
    aspectRatio: z.enum(["3:4", "9:16", "1:1"]).default("3:4"),
  }),
  async execute(input, ctx) {
    const creator = requireStudioPrincipal(ctx.session.auth.current);
    requireStudioConfigured();
    const refs = (process.env.ALEXA_APPROVED_REFERENCE_URLS || "")
      .split(",").map((url) => url.trim()).filter(Boolean);
    if (refs.length < 1 || refs.length > 3 || refs.some((url) => {
      try { return new URL(url).protocol !== "https:"; } catch { return true; }
    })) {
      throw new StudioError("Set 1-3 approved, HTTPS-accessible ALEXA_APPROVED_REFERENCE_URLS or upload photos through /studio.", 423);
    }
    const requestId = await queueMedia("photo", photoInput(validatePrompt(input.prompt), refs, input.aspectRatio));
    const ticket = createJobTicket(creator.id, "photo", requestId);
    return {
      status: "queued",
      kind: "photo",
      studioLink: "/studio?kind=photo&ticket=" + encodeURIComponent(ticket),
      message: "Photo generation queued. Open the creator studio for progress, reference comparison and human likeness approval. No automated percentage is claimed.",
    };
  },
});

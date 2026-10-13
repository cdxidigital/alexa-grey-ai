# Alexa Grey AI | Consent-gated clone photo and video studio

**Branch:** feature/immersive-alexa-persona
**Date:** 2026-10-13
**Status:** Source implementation and preflight validation needed. No claims of deployed capability, perfect face matching, third-party consent, or successful paid generations.

## What is implemented

- Authenticated **/studio** creator workspace, separate from public chat.
- Allowlist protection with Vercel/Better Auth session: `ALEXA_STUDIO_ALLOWED_EMAILS`.
- Server-side activation only after explicit likeness consent record ID, adult identity verification flag and provider API key are configured.
- 1–3 local reference images selected in browser; browser compresses them and holds them only in tab memory until submission.
- Reference-guided still image generation using `google/nano-banana-2.1/edit` on fal.ai at 2K.
- Asynchronous provider queue, signed 12-hour owner-scoped tickets, polling and error display.
- Creator likeness review of completed assets. Ratings of 98–100 are subjective creator ratings, not measured biometric similarity.
- Signed approval tokens for reused photos; no video request can start from an unapproved generated still.
- Image-to-video with `fal-ai/kling-video/v3/pro/image-to-video`, producing 5/10/15-second silent clips from creator-reviewed stills.
- An additional review step for video outputs.
- Eve tools `create_alexa_photo` and `create_alexa_video`, each requiring an authenticated allowlisted Better Auth user **and** human approval before a paid call.
- Links between the chat and the Studio, including chat-generated queue jobs.

## Configuration

The following **server-side** environment variables are required. Never send their values to the browser or commit them:

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Existing application sessions; also a signed-ticket fallback |
| `VERCEL_APP_CLIENT_ID`, `VERCEL_APP_CLIENT_SECRET` | Existing login integration |
| `ALEXA_STUDIO_ALLOWED_EMAILS` | Comma-separated creator and authorised-operator emails |
| `ALEXA_LIKENESS_CONSENT_RECORD_ID` | Actual written consent record reference, verified outside code |
| `ALEXA_CREATOR_ADULT_VERIFIED=true` | Operator attestation of documented identity/adult verification |
| `STUDIO_SIGNING_SECRET` | At least 24 characters, separate from session secret |
| `FAL_KEY` | Paid fal.ai account/API key |
| `ALEXA_APPROVED_REFERENCE_URLS` | Optional comma-separated **approved** HTTPS reference URLs for the Eve photo tool |

**Important:** Environment variables are declarations by the application operator, not a replacement for identity verification or a signed creator consent record. Do not configure consent until Alexa personally approves scope, provider processing, synthetic images and intended distribution. Obtain separate permission for voice cloning if later added.

A newly provisioned deployment should remain **locked** until consent, age verification, the allowlist, signing secret and API key are configured. Public chat remains separate; do not put reference images, signed approval tokens or identity documents in public chats.

### Minimal local checks

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build:eve
pnpm dev
```

Open `/studio` with an explicitly allowlisted authenticated account. Production builds and model calls have **not** been run in this response environment, so treat tests as pending until CI and live smoke tests pass.

## Studio walkthrough

1. Obtain signed likeness authorisation, verify adulthood, document permitted inputs and approved third-party processing.
2. In the authenticated studio, select 1–3 authentic, non-explicit, creator-approved portraits.
3. Enter a non-explicit fashion, lifestyle or editorial prompt; choose ratio; confirm rights and provider costs.
4. Submit photo job and monitor the real provider queue.
5. Compare every generated photo against authentic reference portraits. The creator may choose a **subjective 98–100% rating** and approve; there is no fabricated objective score.
6. To animate, select that approved photo and choose natural motion and 5/10/15 seconds; no unapproved image can be used as a starting frame.
7. Review video for facial drift, unnatural eye behaviour, expression distortion and consistency. Reject clips with visible issues.
8. Open output files for local review. No social publication, voice clone or automatic monetisation occurs.

## About the 98–100% request

The similarity target is a **creative acceptance criterion**, not a performance guarantee. Generative models can change facial features, particularly under large pose changes, low light, hard motion, or occlusion. A human slider is not a scientific facial-match percentage.

A rigorous future evaluation should be based on:
- Creator-approved originals, multiple angles/lighting examples, and separate held-out test photos.
- Human side-by-side blinded review of every still and representative video frames.
- Optional calibrated face-embedding similarity with consent and documented false-positive thresholds (avoid uncalibrated scores presented as percentages).
- A reject/regenerate loop with budget and quality monitoring, and a creator-controlled release gate.
- Frame-level video checks for identity drift and artifact detection.

Even with those controls, perfect identity reproduction cannot be promised.

## Technical design

### Models (current reference)

- Photo: [Nano Banana 2.1 Edit API](https://fal.ai/models/google/nano-banana-2.1/edit/api)
- Video: [Kling V3 Pro Image-to-Video API](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api)
- Uses fal's documented **queue REST API** via server-to-server `fetch`; no new npm dependency, avoiding lockfile drift.
- The app never returns `FAL_KEY` to the browser.

### API endpoints

| Endpoint | Method | Function |
| --- | --- | --- |
| `/api/studio/access` | GET | Access/config status for authenticated allowed users |
| `/api/studio/jobs` | POST | Submit image or video generation after rights/cost acknowledgement |
| `/api/studio/jobs?ticket=...` | GET | Fetch owner-bound job state and output URL |
| `/api/studio/review` | POST | Recheck a completed job and issue creator-rated approval token |

### Privacy and data retention

- **Current limitation:** uploaded source photos are not persisted in the application's own asset vault. They leave the browser only on explicit submission to fal.ai. The server sends compressed images as base64 data URIs; they may appear in the provider's request history or media retention systems subject to provider policy.
- Generated files are returned as **provider-hosted URLs**, not private encrypted storage. Do not advertise outputs as encrypted or secret by default.
- Browser job history contains ticket IDs, prompts, provider output URLs and approval tokens in `sessionStorage` (same tab); reference photo bytes are held only in component memory.
- Tokens expire after 12 hours; links may outlive their token according to provider retention. Consent revocation must also be followed up with provider-side retention/deletion requests as applicable.
- Before production with sensitive creator media, add a private object-storage asset vault, durable audit/approval database, provider-retention controls and dedicated deletion workflows.

### Commercial controls

Provider generation incurs real costs per image and video second. The operator must configure a fal.ai budget/spend cap and infrastructure rate limiting before enabling the service publicly. The code currently allows only allowlisted authenticated users, explicit consent gating, and requires a paid-action confirmation, but **does not implement persistent cross-region quota enforcement**. Do not expose the provider to every follower.

### Supported boundaries

Non-explicit fashion/editorial/beauty/lifestyle content only. No realistic synthetic explicit sexual depictions of a real creator. The app does not accept or fulfil escort bookings, publish social media, generate cloned speech or automatically claim authentic photos.

### Acceptance / QA matrix

1. Unauthenticated users cannot open the Studio or submit jobs.
2. A signed-in, non-allowlisted user cannot submit, poll or approve an asset.
3. Missing real consent record/verified adult flag returns a locked response.
4. Missing provider key returns a clear configuration error, no fake media.
5. Reference files must match JPEG/PNG/WebP signatures; oversized files fail.
6. User-supplied arbitrary provider URL cannot bypass photo review to start a video.
7. A job ticket is restricted to its owner and expires after 12 hours.
8. A likeness rating below 98 cannot issue an asset approval token.
9. Image and video jobs return genuine provider queue states and media URLs.
10. Video output remains unapproved until explicitly reviewed.
11. Credentials and original references are not included in public chat responses.
12. Failed model requests show recoverable errors, not fake completions.
13. The AI tool requires human approval before paid generation.
14. Chat-generated ticket links reopen the correct job in Studio.
15. All generated media is accurately described as AI-generated.

## Before commercial beta

**Blockers:** signed creator consent/age verification; API key and cost cap; successfully passing CI/typecheck, real provider smoke calls, manual facial likeness comparison; verified privacy/provider retention; durable approval database and private asset storage; rate limiting and abuse protection.

Do not declare the clone a 98–100% measured match or call the integration production-ready until those checks actually pass.

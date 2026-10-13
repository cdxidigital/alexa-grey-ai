# Alexa Grey AI

An Eve-powered conversational AI persona and a restricted, creator-controlled likeness production studio.

**This is an AI experience, not the human Alexa typing live.** The chat UI labels the persona accordingly and the studio requires explicit creator authorisation.

## Features

- Source-grounded Alexa Grey brand voice, cheeky Australian fan banter and transparent AI identification.
- **/studio** for 1–3 approved reference images, real queued 2K photo generation, likeness review and short 5/10/15-second image-to-video clips.
- Eve tools for authorised photo/video generation from chat, with human approval for every paid call.
- Consent, identity and operator allowlist controls; signed, owner-bound job and media tokens.
- Draft influencer content at `agent/content/alexa-content-starter-pack.md`; source material at `agent/knowledge/alexa-website-sourcebook.md`.

## Setup

Requirements: Node 24, pnpm, a working Vercel login/Better Auth configuration, a fal.ai API key, creator-approved reference media, a verified adult creator, and a genuine explicit likeness permission record.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
# Configure the required server-side variables in .env.local
pnpm typecheck
pnpm build:eve
pnpm dev
```

Open `/` for the chat and `/studio` for restricted creator media production.

**Do not set the consent-related environment variables until the creator has personally authorised the intended likeness use and third-party media processing.**

For detailed setup, API models, paid usage, image/video workflow, privacy limitations, revocation caveats and QA, read **[Likeness Studio Guide](docs/likeness-studio.md)**.

## Source and authorisation boundaries

The Alexa Grey public brand profile is reconstructed from first-party [site-data.ts](https://github.com/cdxidigital/alexagrey-2026/blob/main/src/lib/site-data.ts) and related site source. Live `alexagrey.fleshsesh.fans` content was not fully accessible to this authoring environment at the time of the original research, so current rates, ages, whereabouts, authentic image rights and new updates must be verified separately.

A 98–100% likeness is a **target**, not something we can guarantee, nor a scientific percentage proven by the creator-review slider.

Media generation is **non-explicit** and initially confined to authorised accounts. Do not create explicit synthetic sexual content of a real person.

## Testing and release state

This repository includes a GitHub Actions CI workflow for installation, TypeScript and Eve build checks. All real provider calls require legitimate configured credentials and may incur charges. CI never sends a paid image or video request.

Until live smoke tests, manual likeness review, creator approval, private asset storage, audit records and durable provider-spend limits are completed, treat this feature as a **consent-gated beta implementation**, not a production-ready media vault.

## Framework

The agent runs on [Eve](https://eve.dev), and the web app is [Next.js](https://nextjs.org).

To run the Eve console, use `pnpm dev:eve`. To deploy via the configured project, use `pnpm deploy` only after confirming the intended Vercel environment and successful checks.

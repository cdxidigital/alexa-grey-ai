# Ellie May AI Concierge

Release: **v0.1 internal prototype** | Template: 1.0.0 | Updated: 8 November 2026
State: `project-state.json` | Source: https://github.com/cdxidigital/alexa-grey-ai/tree/cdxi/ellie-ai-concierge-v1
Draft PR: https://github.com/cdxidigital/alexa-grey-ai/pull/3
Readiness: **building**, not deployed or released.

## Brief

Ellie May (formerly Alexa Grey) requires a creator-controlled AI concierge for repetitive, non-graphic digital-business enquiries, prospect screening and operator drafts. The intended future phone receptionist and voice clone require explicit, specific likeness consent and separate legal/vendor review. The agent must always disclose that it is synthetic.

## Now / Next / Later

**Now (v0.1):** private, allowlisted screening and operator simulator; synthetic-only encrypted queue contracts, audited Postgres adapter, dashboard, negative-case testing and staged review. No real customer input.

**Next:** regenerate `pnpm-lock.yaml`; verify Node 24 installation/Next/Eve builds; provision isolated Postgres/secret manager; test live route permissions, migration and retention purge; confirm Ellie-approved public FAQs; implement controlled human handoff.

**Later (approval-gated):** live chat integrated into Ellie's approved website, legitimate external enquiries, and a disclosed real-time telephone receptionist using a separately licensed voice if specifically authorised.

**Excluded:** physical-service brokering/appointments, payments, unapproved rates, simulated intimacy, explicit sexual exchanges, unverified age assurance claims, voice impersonation, recordings or outbound messages without approved permissions.

## Decisions

- Current public brand **Ellie May**. Do not reuse historic Alexa Grey facts without approval.
- Retain the near-black `#080908`, gold `#d7b46a` and ivory `#eee8dc` presentation.
- `/concierge` plus associated API operations require a **specific Better Auth user-ID allowlist**, fail closed by default.
- The new `/api/concierge/queue` and `/[id]` routes allow **four server-defined fictional fixtures only** and are locked unless explicit synthetic DB configuration is present.
- The encrypted queue uses AES-256-GCM with record-bound authenticated context, pseudonymised operator audit IDs and human-only, optimistic-concurrency versioned transitions.
- A separate offline HTML preview has scripted screens and ephemeral fictional queue state; it is **not** proof that the Next/Postgres runtime works.
- Voice cloning, telephone routing and customer submission remain disabled.

## Progress

**15 / 29 evidenced effort points = 51%; Stage 4 of 8 (Foundation) is the earliest unresolved gate.**

Stages 1-3 passed against existing evidence. Stages 4-6 partial and pending. Stages 7-8 pending and require creator/compliance approval. The denominator remains 29 after splitting earlier tasks into independently checkable parts; scope is not reduced.

**Passed:** baseline 19 local Node tests, plus 28 new queue crypto/contract/transaction tests = **47 local tests passed** using Node 22; TS/TSX syntax transpilation passed for the added routes and component using TypeScript 5.8.3. The offline HTML queue simulator passed Chromium at 360,390,768,1024,1440 px including sample addition, human transition, safety state, reset, zero page errors and no overflow.

**Not run/verified:** full dependency installation, frozen pnpm-lockfile, complete TypeScript check, Next/Eve build, real Postgres transaction, private auth browser integration, real-device testing and hosted deployment. No production permission or voice consent has been established.

## Continuation

Last verified: new secure queue core, storage adapter, auth-gated routes and black-gold React queue panel committed to PR #3. Standalone HTML preview is locally browser-verified; no production changes.

Exact next ready action: in an authorised Node 24 networked build environment, regenerate `pnpm-lock.yaml`, perform complete typecheck and builds, migrate only an isolated synthetic test DB and validate the allowlisted routes with real credentials. Do not enable customer intake until separately approved.

Blockers:
- **cdxi:** stale pnpm lock, no integrated Node 24/Next/Eve build or isolated database validation.
- **Ellie:** current persona and separate voice likeness consent, current FAQs and business boundaries not signed off.
- **Compliance:** WA recording rules, age assurance, Australian privacy, adult-industry advertising and provider terms require review.

Rollback: PR #3 stays a draft, not merged. No production schema migration or deployment occurred.

## Scope and improvement history

- 2026-11-08: Original 29-point active scope maintained. Splits T05/T06/T08 preserved denominator.
- 2026-11-08: Split T05b/T06b to distinguish verified synthetic contracts from blocked customer/voice integrations (29 -> 29).
- Original escaped email/phone regex was fixed and regression-tested.
- Project-local improvement: **synthetic fixture-only routes** are a stronger safe-development default than accepting operator-entered free text. Keep this as a candidate for reusable test fixtures in other consent-sensitive projects, without editing global skill rules.

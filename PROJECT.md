# Ellie May AI Concierge

Release: **v0.1 internal prototype** | Template: 1.0.0 | Updated: 2026-11-08
State: `project-state.json` | Source: https://github.com/cdxidigital/alexa-grey-ai/tree/cdxi/ellie-ai-concierge-v1
Draft PR: https://github.com/cdxidigital/alexa-grey-ai/pull/3
Readiness: **building**, not released.

## Brief

Ellie May (formerly Alexa Grey) requires a consent-controlled AI concierge for routine non-graphic digital business enquiries. It should use an approved natural Australian voice-of-brand, screen incomplete leads, prepare drafts, and pass decisions to a human. A future call receptionist and real cloned voice require separate permissions.

## Bounded release

**Now:** deterministic triage, synthetic preview, creator-only access controls, internal text persona, negative-case tests, documented next integration boundaries.

**Next:** complete Node 24 installation and full Next/Eve typecheck/build; encrypted access-controlled enquiry storage; creator review workflow; connect the approved website chat and FAQ content.

**Later / approval-gated:** live telephone routing, separately licensed synthetic voice, true inbound customer data, public launch, optional analytics.

**Excluded:** physical service bookings, payments, unapproved price quotations, sexual chat, impersonation, collection of unnecessary personal data, live recordings.

## Design and decisions

- Current name **Ellie May**; historic Alexa Grey information is not automatically a current fact.
- Preserve black-gold website system: obsidian `#080908`, champagne gold `#d7b46a`, ivory `#eee8dc`.
- Disclose that the agent is AI. The private operator preview is restricted by Better Auth user IDs in `ELLIE_ADMIN_USER_IDS`. No allowlist means no access.
- The offline HTML is a separate interactive scripted simulation. It does not connect to the Eve model or production site.
- Call, voice, pricing, and physical-service booking features remain disabled.

## Progress and gates

**13 / 29 evidenced effort points, 44% of the active release plan. Stage 4/8 Foundation is the earliest unresolved gate.**

Stages 1 Brief, 2 Roadmap, 3 Design: passed with source-backed evidence. Stages 4 Foundation, 5 Build, 6 Verify: partially implemented, not passed. Stages 7 Release and 8 Handover: pending.

**Checks passed:** `node --test agent/lead-triage.test.mjs lib/concierge/access.test.mjs` locally, 19/19 passing. Standalone browser preview passed interactive inbox, safety and chat simulations at 360, 390, 768, 1024 and 1440 px, without page errors or horizontal overflow.

**Checks not run:** full repository `npm install`, TypeScript, Next/Eve build, hosted integration, production authorization testing and real phone checks. The container lacks direct GitHub network connectivity and the repository targets Node 24.

## Continuation

Last verified outcome: contact regex fixed; access control and sample simulator committed; local regression and browser checks passed.

Exact next action: run full Node24 build in a repository-connected environment; review failed checks; configure the creator's allowlisted Better Auth ID through private deployment settings; design an encrypted retained-only-when-permitted handoff store.

Blockers: signed voice/persona approvals (Ellie), privacy/recording/advertising review (qualified reviewer), and production security/data retention design (cdxi). No real contact data or voice files were uploaded.

Rollback: the existing PR remains **draft** and unmerged. Closing the branch leaves production unchanged.

## Scope changes

2026-11-08: Split original tasks T05, T06 and T08 into verifiable subtasks. **29 points before and after**, no denominator reduction. Previous recorded 17% used only then-evidenced five points. Current 44% is backed by new test, source and preview evidence.

## Improvement log

2026-11-08: Initial overly escaped contact regex rejected valid emails and telephone numbers. Root cause reproduced locally; fixed and added explicit representative-input regression tests. Adopted **project-local**; candidate for future reusable test template, not an automatic change to the global project skill.

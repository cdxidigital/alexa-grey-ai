# Ellie May Concierge · Internal development handover

**Working branch:** `cdxi/ellie-ai-concierge-v1`  
**Status:** private synthetic prototype only. No public release, live calls or customer data pipeline.

## Entry points

- `/concierge` shows a four-example interactive screening desk **only when** Better Auth is signed in and its `session.user.id` occurs in `ELLIE_ADMIN_USER_IDS`.
- `POST /api/concierge/preview` is protected by the same allowlist, checks same-origin JSON requests and rejects oversized payloads. It does not persist the input.
- `agent/lead-triage.mjs` is the deterministic lead classifier. Review flags supplied by an operator in the simulator are not trusted safety determinations for a public endpoint.
- `agent/instructions.md` uses the Ellie May draft persona. The existing Eve text channel is also operator restricted; Vercel-issued infrastructure credentials and local developer access use separate Eve auth helpers.

## Requirements

- Node.js 24 matching the repository's `engines` field.
- Set `BETTER_AUTH_SECRET`, Vercel OAuth application configuration and `ELLIE_ADMIN_USER_IDS` to comma-separated **Better Auth user IDs** of specifically approved operators. **Never** put real IDs, email lists, passwords or keys into git.
- With no allowlist, access is denied even in development. Do not broaden this condition for convenience.

## Local test commands

```sh
npm install
npm run test:concierge
npm run typecheck
npm run build:eve
npm run build
```

The first command and full TypeScript/Eve/Next builds still require a Node 24 environment with dependencies. In this handoff, only the dependency-free Node tests have run in the container; full application build and deployment have **not** been verified.

## External preview

`ellie-may-concierge-preview.html` is a self-contained separate browser mock using **fictional examples** and scripted chat. It has no backend connection and is intentionally safe to open offline. Its chat responses are templates, not generated Eve model replies.

## Before production

1. Ellie explicitly approves current creator identity, copy, permitted digital offers, response boundaries and public channels.
2. Obtain separate signed voice likeness/synthesis consent with vendors, allowed use, revocation, duration and recorded samples scope.
3. Validate current WA/Australian surveillance, privacy, age assurance, advertising and applicable platform constraints.
4. Confirm voice carrier/model provider supports the exact use case; configure truthful recording disclosures.
5. Add an authenticated, encrypted, retention-controlled database and per-record audit/history, correctable contact fields and safe deletion.
6. Implement spam and threat escalation **independently of caller-supplied flags**, rate limits and bot defences.
7. Add written approval of any contact delivery, public publishing, booking/payment feature and outbound email.
8. Run production-scale tests, penetration review, real mobile QA, staged rollout and tested emergency kill switch.

## Rollback

Leave the current pull request draft and unmerged. If inspection finds an issue, revert or close the isolated branch without touching the site production deployment. No production migrations have occurred.

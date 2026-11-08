# Ellie May AI Concierge
Release v0.1 | Extended | 8 Nov 2026
Source: https://github.com/cdxidigital/alexa-grey-ai/tree/cdxi/ellie-ai-concierge-v1
Readiness: building. This branch is *not* a production release.

## Brief
An openly disclosed AI assistant for routine caller/chat triage, general brand FAQs, digital collaboration enquiries and human-approved follow-up. Preserve creator boundaries and existing black/gold site.

## Now
Document operating policy, implement bounded triage and test cases, prepare integration and handoff contracts.

## Next
Creator review of voice/tone, approved FAQs, secure admin queue, live chat integration, telephony vendor assessment, real test harness.

## Later
Opt-in voice cloning, approved real-time receptionist, analytics and creator dashboard.

## Exclusions
No physical service booking, payment collection, false prices, impersonation, age verification by checkbox, or recording without legal review.

## Continuation
Existing Eve agent uses former Alexa Grey identity and cannot automatically be treated as approved Ellie May representation.
Run `node --test agent/lead-triage.test.mjs` and fix any failures before integrating.
Consent, provider policy and legal review block public launch. Retain rollback via branch isolation.

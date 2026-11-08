# Ellie May Concierge | Encrypted Queue v0.1 Handover

**Status:** development only, not live. Draft PR #3. The current code accepts **four fixed fictional samples only**. It will reject arbitrary visitor messages and real intake even if credentials are configured.

## Operator-only workflow

1. Sign into the existing Better Auth installation. The account must match an ID in `ELLIE_ADMIN_USER_IDS`.
2. Open `/concierge` and choose **Check private queue**.
3. If approved *synthetic* PostgreSQL settings have not been provided, the feature reports **storage locked**.
4. After isolated test DB setup, save one of `E-001` to `E-004`. Sensitive fixture details are sealed using AES-256-GCM. No customer data, phone audio or outward communications are used.
5. Review the simulated case. Each permitted status change uses an expected version, a database transaction, and a pseudonymous operator audit entry.
6. Safety escalations cannot be marked directly resolved by the agent or operator button; archiving is the only transition in this prototype.

## Configuration gates

Set privately in the deployment environment only, never in Git or this document:

- `ELLIE_ADMIN_USER_IDS`: comma-separated, specifically approved Better Auth **user IDs**.
- `ELLIE_QUEUE_ENABLED=true`: explicit opt-in; default is disabled.
- `ELLIE_QUEUE_MODE=synthetic`: the only mode implemented.
- `ELLIE_QUEUE_DATABASE_URL`: URL of an isolated Postgres database over verified TLS (local dev may use localhost).
- `ELLIE_QUEUE_ENCRYPTION_KEY_B64`: securely generated 32-byte random key, encoded using canonical base64. Use `openssl rand -base64 32` or an approved secrets manager. Do not log or expose this key.
- `ELLIE_QUEUE_KEY_ID=v1`: registered encryption key version.
- `ELLIE_QUEUE_RETENTION_DAYS=7` (example): explicit integer between 1 and 30.

The queue refuses to enable if the configuration is incomplete or changes to an unapproved `real` mode. **Do not enable the database feature in production until the dependency lockfile, migrations, data isolation and authorisation checks are verified.**

## Migration

Run `migrations/20261108_ellie_queue.sql` using a DBA-controlled account in an approved isolated database. Grant only the needed SELECT/INSERT/UPDATE/DELETE rights on `ellie_concierge.enquiries` and INSERT on `ellie_concierge.audit_events` to a dedicated runtime role. Never use a superuser in the application.

The schema stores source/category/disposition metadata in cleartext; contact details, purpose, timeframe, flags and fixture ID are encrypted. Actor IDs are HMAC-pseudonymised before audit storage. Audits are inserted in the same transaction as queue mutations. The UI and API are not public.

## Retention and deletion

Reads purge expired queue entries and their cascaded audits. This **is not sufficient for guaranteed expiry enforcement**: implement an independent scheduled purge and audited deletion/correction flow before any real customer launch. A future key-rotation mechanism and recovery tests are also needed.

## Verification

- Narrow Node tests, including 14 triage, 5 access, 20 encrypted queue and 8 DB-adapter mocked transactions: **47 passing locally** using Node 22. They do not test a live Postgres instance or deploy.
- TypeScript/TSX syntax transpilation for new route and UI files passed using TypeScript 5.8.3. **Full typecheck/build not run.**
- Standalone v0.3 offline HTML queue, chat and control preview was checked at 360, 390, 768, 1024 and 1440 px using Chromium with no page errors or horizontal overflow. It is a simulated interface, not the actual protected Next application.

## Known integration blocker

`package.json` now declares `pg` and `@types/pg` but the original `pnpm-lock.yaml` has not been regenerated. The environment used for this patch has Node 22 and no external npm registry access; it is **not** valid to claim a frozen-lockfile install, Node 24 typecheck or Next/Eve build. Regenerate the lockfile with the project's pinned package manager in an authorised networked environment, then run:

```sh
pnpm install --lockfile-only
pnpm install --frozen-lockfile
pnpm run test:concierge
pnpm run typecheck
pnpm run build:eve
pnpm run build
```

## Future customer/publishing requirements

Separate Ellie May's specific consent for text identity, synthetic voice, recordings, vendors, usage rights, duration and revocation. Confirm adult-industry vendor eligibility and Australian privacy, age-assurance, advertising and WA call-recording rules for the exact configured workflow. Introduce verified age assurance where required, rate limits, independent abuse detection, rights-of-access/deletion controls, key rotation, restoration testing, immutable audit strategy and a tested kill switch. Public deployment, live telephone routing and external outreach need separate approved release gates.

## Rollback

Keep PR #3 draft and unmerged. No production schema migration, environment change or call integration has been executed as part of this work.

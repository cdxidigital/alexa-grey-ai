-- INTERNAL ELLIE MAY QUEUE, SYNTHETIC DATA ONLY IN v0.1.
-- Run only in an approved, access-restricted Postgres instance with a dedicated
-- least-privilege application role. Rollback requires a data deletion decision.
CREATE SCHEMA IF NOT EXISTS ellie_concierge;

CREATE TABLE IF NOT EXISTS ellie_concierge.enquiries (
  id UUID PRIMARY KEY,
  creator_id TEXT NOT NULL CHECK (creator_id = 'ellie-may'),
  channel TEXT NOT NULL CHECK (channel IN ('web', 'phone', 'email')),
  category TEXT NOT NULL CHECK (category IN ('general', 'media', 'collaboration', 'technical', 'other')),
  status TEXT NOT NULL CHECK (status IN (
    'needs_information', 'qualified_for_human_review', 'human_review',
    'safety_review', 'resolved', 'archived'
  )),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  encryption_key_id TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS ellie_concierge.audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enquiry_id UUID NOT NULL REFERENCES ellie_concierge.enquiries(id) ON DELETE CASCADE,
  actor_digest CHAR(64) NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created','status_changed')),
  status_before TEXT,
  status_after TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ellie_enquiries_expiry_idx
  ON ellie_concierge.enquiries (expires_at);
CREATE INDEX IF NOT EXISTS ellie_enquiries_created_idx
  ON ellie_concierge.enquiries (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ellie_audit_enquiry_idx
  ON ellie_concierge.audit_events (enquiry_id, created_at DESC);

-- Database privileges are intentionally not granted to PUBLIC.
REVOKE ALL ON SCHEMA ellie_concierge FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA ellie_concierge FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ellie_concierge FROM PUBLIC;

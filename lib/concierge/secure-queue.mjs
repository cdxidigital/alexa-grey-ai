/**
 * Private Ellie May concierge queue: synthetic samples ONLY in this release.
 * A deliberately strict boundary between a human-operated preview and live intake.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { triageEnquiry } from '../../agent/lead-triage.mjs';

export const CREATOR_ID = 'ellie-may';
export const QUEUE_STATES = Object.freeze([
  'needs_information', 'qualified_for_human_review', 'human_review',
  'safety_review', 'resolved', 'archived',
]);

const NEXT_STATES = Object.freeze({
  needs_information: ['human_review', 'archived'],
  qualified_for_human_review: ['human_review', 'archived'],
  human_review: ['needs_information', 'resolved', 'archived'],
  safety_review: ['archived'],
  resolved: ['archived'],
  archived: [],
});

// There is no path for saving visitor-supplied text in synthetic mode.
const FIXTURES = Object.freeze({
  'E-001': Object.freeze({
    channel: 'web', category: 'collaboration', contact: 'studio@example.org',
    purpose: 'Discuss an upcoming editorial brand campaign',
    timeline: 'Next month', adultAttested: true,
  }),
  'E-002': Object.freeze({
    channel: 'web', category: 'general', contact: '',
    purpose: 'Ask about a potential business project',
    timeline: 'Later this month', adultAttested: true,
  }),
  'E-003': Object.freeze({
    channel: 'web', category: 'other', contact: 'person@example.org',
    purpose: 'Request details of an unapproved commercial offer',
    timeline: 'This week', adultAttested: true, requestsUnapprovedOffer: true,
  }),
  'E-004': Object.freeze({
    channel: 'web', category: 'general', contact: 'other@example.org',
    purpose: 'Send a threatening or harassing message',
    timeline: 'Today', adultAttested: true, threatOrHarassment: true,
  }),
});

export function readQueueConfig(env = {}) {
  if (env.ELLIE_QUEUE_ENABLED !== 'true') return Object.freeze({ enabled: false });
  if (env.ELLIE_QUEUE_MODE !== 'synthetic') {
    throw new Error('Real customer intake is not implemented or authorised');
  }
  const retentionDays = Number(env.ELLIE_QUEUE_RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 30) {
    throw new Error('Explicit retention must be 1-30 days');
  }
  const keyString = env.ELLIE_QUEUE_ENCRYPTION_KEY_B64;
  if (typeof keyString !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(keyString)) {
    throw new Error('Missing or malformed 256-bit encryption key');
  }
  const key = Buffer.from(keyString, 'base64');
  if (key.length !== 32 || key.toString('base64') !== keyString) {
    throw new Error('Missing or malformed 256-bit encryption key');
  }
  const databaseUrl = env.ELLIE_QUEUE_DATABASE_URL;
  if (typeof databaseUrl !== 'string' || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error('Missing Postgres configuration');
  }
  const keyId = env.ELLIE_QUEUE_KEY_ID;
  if (typeof keyId !== 'string' || !/^[a-zA-Z0-9_-]{1,20}$/.test(keyId)) {
    throw new Error('An explicit encryption key ID is required');
  }
  return { enabled: true, mode: 'synthetic', retentionDays, key, keyId, databaseUrl };
}

function ensureKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new TypeError('A 256-bit key is required');
}
function aadFor(id, keyId) {
  return Buffer.from(`${CREATOR_ID}:queue:v1:${id}:${keyId}`, 'utf8');
}
export function encryptPrivateDetails(details, { key, keyId, id }) {
  ensureKey(key);
  if (typeof id !== 'string' || typeof keyId !== 'string') throw new TypeError('Invalid encryption context');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aadFor(id, keyId));
  const value = Buffer.from(JSON.stringify(details), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return { keyId, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
export function decryptPrivateDetails(sealed, { key, id }) {
  ensureKey(key);
  if (!sealed || typeof sealed !== 'object') throw new TypeError('Missing sealed record');
  const iv = Buffer.from(sealed.iv, 'base64');
  const tag = Buffer.from(sealed.tag, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new TypeError('Invalid encryption metadata');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aadFor(id, sealed.keyId));
  decipher.setAuthTag(tag);
  const raw = Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, 'base64')), decipher.final()]);
  return JSON.parse(raw.toString('utf8'));
}
export function anonymizeOperator(userId, key) {
  ensureKey(key);
  if (typeof userId !== 'string' || userId.trim().length === 0) throw new TypeError('Operator identity required');
  return createHmac('sha256', key).update('audit:operator:v1:').update(userId).digest('hex');
}
export function isQueueId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
/** Prepare a record from a fixed fictional fixture; NEVER arbitrary visitor input. */
export function createSyntheticEnquiry({ sampleId, actorId, config, now = new Date() }) {
  if (!config?.enabled || config.mode !== 'synthetic') throw new Error('Synthetic queue is disabled');
  if (!Object.hasOwn(FIXTURES, sampleId)) throw new TypeError('Unknown fictional sample');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('Invalid timestamp');
  const item = FIXTURES[sampleId];
  const triage = triageEnquiry(item);
  const id = randomUUID();
  const expiresAt = new Date(now.getTime() + config.retentionDays * 86_400_000).toISOString();
  const sealed = encryptPrivateDetails({
    contact: item.contact, purpose: item.purpose, timeline: item.timeline,
    flags: triage.flags, fixtureId: sampleId,
  }, { key: config.key, keyId: config.keyId, id });
  return {
    id, creatorId: CREATOR_ID, channel: triage.channel, category: triage.category,
    status: triage.disposition, createdAt: now.toISOString(), expiresAt,
    version: 1, sealed, actorDigest: anonymizeOperator(actorId, config.key),
    automaticBookingAllowed: false, automaticOutreachAllowed: false,
  };
}
export function revealQueueRecord(record, config) {
  if (!config?.enabled || record?.creatorId !== CREATOR_ID) throw new Error('Queue access denied');
  if (!isQueueId(record.id)) throw new TypeError('Malformed record identifier');
  if (new Date(record.expiresAt).getTime() <= Date.now()) throw new Error('Record has expired');
  const details = decryptPrivateDetails(record.sealed, { key: config.key, id: record.id });
  return {
    id: record.id, channel: record.channel, category: record.category,
    status: record.status, version: record.version,
    createdAt: record.createdAt, expiresAt: record.expiresAt,
    ...details, synthetic: true,
  };
}
/** Human decision gate. No automatic state changes on the basis of chatbot text. */
export function reviewTransition(current, requested, expectedVersion) {
  if (!QUEUE_STATES.includes(current) || !QUEUE_STATES.includes(requested)) throw new TypeError('Invalid status');
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new TypeError('Version required');
  if (!NEXT_STATES[current].includes(requested)) throw new Error('Forbidden status transition');
  return { from: current, to: requested, expectedVersion, nextVersion: expectedVersion + 1 };
}
export function listFixtureIds() { return Object.keys(FIXTURES); }

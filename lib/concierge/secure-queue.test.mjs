import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  readQueueConfig, createSyntheticEnquiry, revealQueueRecord,
  encryptPrivateDetails, decryptPrivateDetails, anonymizeOperator,
  reviewTransition, isQueueId, listFixtureIds,
} from './secure-queue.mjs';
const key = randomBytes(32);
const env = {
  ELLIE_QUEUE_ENABLED: 'true', ELLIE_QUEUE_MODE: 'synthetic',
  ELLIE_QUEUE_RETENTION_DAYS: '7', ELLIE_QUEUE_ENCRYPTION_KEY_B64: key.toString('base64'),
  ELLIE_QUEUE_KEY_ID: 'v1', ELLIE_QUEUE_DATABASE_URL: 'postgres://localhost/test',
};
const cfg = readQueueConfig(env);
test('disabled queue remains closed', () => assert.equal(readQueueConfig({}).enabled, false));
test('real intake mode is never accepted', () => assert.throws(() => readQueueConfig({...env,ELLIE_QUEUE_MODE:'real'}), /not implemented/));
test('missing or wrong-size encryption key is rejected', () => {
  assert.throws(() => readQueueConfig({...env,ELLIE_QUEUE_ENCRYPTION_KEY_B64:'abc'}), /key/);
  assert.throws(() => readQueueConfig({...env,ELLIE_QUEUE_ENCRYPTION_KEY_B64:randomBytes(16).toString('base64')}), /key/);
});
test('explicit retention bounds enforced', () => {
  assert.throws(() => readQueueConfig({...env,ELLIE_QUEUE_RETENTION_DAYS:'0'}), /retention/);
  assert.throws(() => readQueueConfig({...env,ELLIE_QUEUE_RETENTION_DAYS:'365'}), /retention/);
});
test('database config required', () => assert.throws(() => readQueueConfig({...env,ELLIE_QUEUE_DATABASE_URL:''}),/Postgres/));
test('synthetic fixtures are fixed', () => assert.deepEqual(listFixtureIds(),['E-001','E-002','E-003','E-004']));
test('arbitrary input cannot enter the synthetic queue', () => assert.throws(() => createSyntheticEnquiry({sampleId:'my-private-email',actorId:'alice',config:cfg}),/Unknown/));
test('encrypted record contains no raw contact, purpose or operator ID', () => {
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'alice',config:cfg});
  const raw=JSON.stringify(r);
  assert.equal(raw.includes('studio@example.org'),false);
  assert.equal(raw.includes('editorial brand campaign'),false);
  assert.equal(raw.includes('alice'),false);
  assert.equal(isQueueId(r.id),true);
  assert.equal(r.automaticBookingAllowed,false);
  assert.equal(r.automaticOutreachAllowed,false);
});
test('encrypted synthetic fixture can be revealed by operator in correct creator context', () => {
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'alice',config:cfg});
  const out=revealQueueRecord(r,cfg);
  assert.equal(out.contact,'studio@example.org');
  assert.equal(out.synthetic,true);
  assert.equal(out.version,1);
});
test('safety synthetic fixture cannot trigger auto outreach', () => {
  const r=createSyntheticEnquiry({sampleId:'E-004',actorId:'alice',config:cfg});
  assert.equal(r.status,'safety_review');
  assert.equal(r.automaticOutreachAllowed,false);
});
test('tampered ciphertext fails authentication', () => {
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'alice',config:cfg});
  const sealed={...r.sealed,ciphertext:Buffer.from('malicious').toString('base64')};
  assert.throws(() => decryptPrivateDetails(sealed,{key,id:r.id}));
});
test('ciphertext cannot be copied to another record id', () => {
  const a=createSyntheticEnquiry({sampleId:'E-001',actorId:'alice',config:cfg});
  const b=createSyntheticEnquiry({sampleId:'E-002',actorId:'alice',config:cfg});
  assert.throws(() => decryptPrivateDetails(a.sealed,{key,id:b.id}));
});
test('incorrect encryption key cannot decrypt details', () => {
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'alice',config:cfg});
  assert.throws(() => decryptPrivateDetails(r.sealed,{key:randomBytes(32),id:r.id}));
});
test('operator ID pseudonyms are stable and key-bound', () => {
  const one=anonymizeOperator('alice',key);
  assert.equal(one,anonymizeOperator('alice',key));
  assert.notEqual(one,anonymizeOperator('bob',key));
  assert.notEqual(one,anonymizeOperator('alice',randomBytes(32)));
});
test('creator mismatch denies record access', () => {
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'alice',config:cfg});
  assert.throws(() => revealQueueRecord({...r,creatorId:'someone-else'},cfg),/denied/);
});
test('human review transitions are explicit and versioned', () => {
  assert.deepEqual(reviewTransition('qualified_for_human_review','human_review',1),{from:'qualified_for_human_review',to:'human_review',expectedVersion:1,nextVersion:2});
});
test('safety escalation cannot be marked resolved without review policy', () => assert.throws(() => reviewTransition('safety_review','resolved',1), /Forbidden/));
test('archived and unknown statuses cannot transition', () => {
  assert.throws(() => reviewTransition('archived','resolved',3),/Forbidden/);
  assert.throws(() => reviewTransition('unknown','archived',1),/Invalid/);
});
test('invalid optimistic concurrency version is rejected', () => assert.throws(() => reviewTransition('human_review','resolved',0),/Version/));
test('encryption metadata requires correct IV and tag', () => {
  const sealed=encryptPrivateDetails({hello:'world'}, {key,keyId:'v1',id:'test'});
  assert.equal(decryptPrivateDetails(sealed,{key,id:'test'}).hello,'world');
  assert.throws(() => decryptPrivateDetails({...sealed,iv:'aGVsbG8='},{key,id:'test'}),/metadata/);
});

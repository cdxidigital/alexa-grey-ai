import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {readQueueConfig,createSyntheticEnquiry} from './secure-queue.mjs';
import {insertSyntheticQueueItem,listQueueItems,reviewQueueItem,purgeExpiredQueueItems} from './queue-store.mjs';
const key=randomBytes(32);
const config=readQueueConfig({
  ELLIE_QUEUE_ENABLED:'true',ELLIE_QUEUE_MODE:'synthetic',ELLIE_QUEUE_RETENTION_DAYS:'7',
  ELLIE_QUEUE_ENCRYPTION_KEY_B64:key.toString('base64'),ELLIE_QUEUE_KEY_ID:'v1',
  ELLIE_QUEUE_DATABASE_URL:'postgres://localhost/test',
});
function fakePool(mock) {
  const calls=[];
  const client={query:async (sql,values=[])=>{calls.push({sql,values});return mock?.(sql,values)??{rows:[],rowCount:1};}, release:()=>calls.push({sql:'RELEASE'})};
  return {calls,connect:async()=>client,query:client.query};
}
test('insert is transactional, encrypted, audited, no plaintext params',async()=>{
  const pool=fakePool();const row=await insertSyntheticQueueItem(pool,config,'operator-7','E-001');
  assert.equal(row.version,1);
  assert.deepEqual(pool.calls.map(x=>x.sql.split(/\s+/).at(0)),['BEGIN','INSERT','INSERT','COMMIT','RELEASE']);
  assert.equal(JSON.stringify(pool.calls).includes('studio@example.org'),false);
  assert.equal(JSON.stringify(pool.calls).includes('operator-7'),false);
});
test('database write failures rollback',async()=>{
  const pool=fakePool(sql=>{if(sql.includes('audit_events'))throw Error('simulated DB failure')});
  await assert.rejects(insertSyntheticQueueItem(pool,config,'operator','E-002'));
  assert.equal(pool.calls.some(x=>x.sql==='ROLLBACK'),true);
});
test('read excludes expired rows in SQL and decrypts valid results',async()=>{
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'operator',config});
  const dbrow={id:r.id,creator_id:r.creatorId,channel:r.channel,category:r.category,status:r.status,version:r.version,
    created_at:r.createdAt,expires_at:r.expiresAt,encryption_key_id:r.sealed.keyId,iv:r.sealed.iv,auth_tag:r.sealed.tag,ciphertext:r.sealed.ciphertext};
  const pool=fakePool(sql=>sql.includes('SELECT *')?{rows:[dbrow]}:{rows:[]});
  const result=await listQueueItems(pool,config,20);
  assert.equal(result[0].contact,'studio@example.org');
  assert.equal(pool.calls[0].sql.includes('expires_at>NOW()'),true);
  assert.equal(pool.calls[0].values[0],'ellie-may');
});
test('successful human review is audited in same transaction',async()=>{
  const pool=fakePool(sql=>sql.includes('FOR UPDATE')?{rows:[{status:'qualified_for_human_review',version:1}]}:{rows:[]});
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'operator',config});
  const out=await reviewQueueItem(pool,config,{id:r.id,actorId:'operator',nextStatus:'human_review',expectedVersion:1});
  assert.deepEqual(out,{id:r.id,status:'human_review',version:2});
  assert.equal(pool.calls.filter(x=>x.sql.includes('audit_events')).length,1);
  assert.equal(pool.calls.some(x=>x.sql==='COMMIT'),true);
});
test('concurrent edit is refused and rolled back',async()=>{
  const pool=fakePool(sql=>sql.includes('FOR UPDATE')?{rows:[{status:'human_review',version:3}]}:{rows:[]});
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'operator',config});
  await assert.rejects(reviewQueueItem(pool,config,{id:r.id,actorId:'operator',nextStatus:'resolved',expectedVersion:1}),{code:'QUEUE_VERSION_CONFLICT'});
  assert.equal(pool.calls.some(x=>x.sql==='ROLLBACK'),true);
});
test('safety record cannot be resolved',async()=>{
  const pool=fakePool(sql=>sql.includes('FOR UPDATE')?{rows:[{status:'safety_review',version:1}]}:{rows:[]});
  const r=createSyntheticEnquiry({sampleId:'E-004',actorId:'operator',config});
  await assert.rejects(reviewQueueItem(pool,config,{id:r.id,actorId:'operator',nextStatus:'resolved',expectedVersion:1}),/Forbidden/);
  assert.equal(pool.calls.some(x=>x.sql==='ROLLBACK'),true);
});
test('a nonexistent queue item does not create audit',async()=>{
  const pool=fakePool(sql=>sql.includes('FOR UPDATE')?{rows:[]}:{rows:[]});
  const r=createSyntheticEnquiry({sampleId:'E-001',actorId:'operator',config});
  assert.equal(await reviewQueueItem(pool,config,{id:r.id,actorId:'operator',nextStatus:'resolved',expectedVersion:1}),null);
  assert.equal(pool.calls.some(x=>x.sql.includes('audit_events')),false);
});
test('purge operation deletes expired records only',async()=>{
  const pool=fakePool(sql=>sql.includes('DELETE')?{rows:[],rowCount:2}:{rows:[]});
  assert.equal(await purgeExpiredQueueItems(pool),2);
  assert.match(pool.calls[0].sql,/WHERE expires_at <= NOW\(\)/);
});

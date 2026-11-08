/** Postgres adapter with transactional human-review state changes. */
import {
  CREATOR_ID, createSyntheticEnquiry, revealQueueRecord,
  reviewTransition, anonymizeOperator, isQueueId,
} from './secure-queue.mjs';

let activePool;
export async function connectQueue(config, environment = 'production') {
  if (!config?.enabled) throw new Error('Queue disabled');
  if (activePool) return activePool;
  // Lazy loaded only when the explicitly configured private queue is enabled.
  const { Pool } = await import('pg');
  const host = new URL(config.databaseUrl).hostname;
  const local = environment === 'development' && ['localhost', '127.0.0.1'].includes(host);
  activePool = new Pool({
    connectionString: config.databaseUrl,
    ssl: local ? false : { rejectUnauthorized: true },
    max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 4000,
  });
  return activePool;
}
function mapRow(row) {
  return {
    id: row.id, creatorId: row.creator_id, channel: row.channel,
    category: row.category, status: row.status, version: row.version,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    sealed: {
      keyId: row.encryption_key_id, iv: row.iv,
      tag: row.auth_tag, ciphertext: row.ciphertext,
    },
  };
}
async function transaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* retain original failure */ }
    throw error;
  } finally { client.release(); }
}
export async function insertSyntheticQueueItem(pool, config, actorId, sampleId) {
  const record = createSyntheticEnquiry({sampleId, actorId, config});
  await transaction(pool, async (client) => {
    await client.query(`INSERT INTO ellie_concierge.enquiries
      (id,creator_id,channel,category,status,version,encryption_key_id,iv,auth_tag,ciphertext,created_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [
      record.id, record.creatorId, record.channel, record.category,
      record.status, record.version, record.sealed.keyId, record.sealed.iv,
      record.sealed.tag, record.sealed.ciphertext, record.createdAt, record.expiresAt,
    ]);
    await client.query(`INSERT INTO ellie_concierge.audit_events
      (enquiry_id,actor_digest,action,status_before,status_after)
      VALUES ($1,$2,'created',NULL,$3)`, [record.id, record.actorDigest, record.status]);
  });
  return { id: record.id, status: record.status, version: record.version };
}
export async function listQueueItems(pool, config, limit = 20) {
  if (!config?.enabled) throw new Error('Queue disabled');
  const count = Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : 20;
  const result = await pool.query(`SELECT * FROM ellie_concierge.enquiries
    WHERE creator_id=$1 AND expires_at>NOW()
    ORDER BY created_at DESC LIMIT $2`, [CREATOR_ID, count]);
  return result.rows.map(row => revealQueueRecord(mapRow(row), config));
}
export async function reviewQueueItem(pool, config, { id, actorId, nextStatus, expectedVersion }) {
  if (!config?.enabled) throw new Error('Queue disabled');
  if (!isQueueId(id)) throw new TypeError('Invalid enquiry identifier');
  if (typeof actorId !== 'string' || !actorId) throw new TypeError('Operator required');
  return transaction(pool, async (client) => {
    const result = await client.query(`SELECT status,version FROM ellie_concierge.enquiries
      WHERE id=$1 AND creator_id=$2 AND expires_at>NOW() FOR UPDATE`, [id, CREATOR_ID]);
    if (result.rows.length !== 1) return null;
    const current = result.rows[0];
    if (current.version !== expectedVersion) {
      const conflict = new Error('Record was changed by another operator');
      conflict.code = 'QUEUE_VERSION_CONFLICT';
      throw conflict;
    }
    const decision = reviewTransition(current.status, nextStatus, expectedVersion);
    await client.query(`UPDATE ellie_concierge.enquiries
      SET status=$1, version=$2, updated_at=NOW()
      WHERE id=$3 AND creator_id=$4 AND version=$5`, [decision.to, decision.nextVersion, id, CREATOR_ID, decision.expectedVersion]);
    await client.query(`INSERT INTO ellie_concierge.audit_events
      (enquiry_id,actor_digest,action,status_before,status_after)
      VALUES ($1,$2,'status_changed',$3,$4)`, [
      id, anonymizeOperator(actorId, config.key), decision.from, decision.to,
    ]);
    return { id, status: decision.to, version: decision.nextVersion };
  });
}
/** Explicit cleanup; an independent scheduled retention job is still required. */
export async function purgeExpiredQueueItems(pool) {
  const result = await pool.query('DELETE FROM ellie_concierge.enquiries WHERE expires_at <= NOW()');
  return result.rowCount ?? 0;
}

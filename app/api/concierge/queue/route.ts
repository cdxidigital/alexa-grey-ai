import type { NextRequest } from 'next/server';
import { configuredQueue, approvedOperator, sameOriginWrite, jsonNoStore, readBoundedJson } from '@/lib/concierge/queue-request';
import { connectQueue, insertSyntheticQueueItem, listQueueItems, purgeExpiredQueueItems } from '@/lib/concierge/queue-store.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const operator = await approvedOperator(request);
  if (!operator) return jsonNoStore({error:'Not found'},404);
  const config = configuredQueue();
  if (!config || !config.enabled) return jsonNoStore({enabled:false,syntheticOnly:true,items:[]},503);
  try {
    const pool = await connectQueue(config, process.env.NODE_ENV);
    await purgeExpiredQueueItems(pool);
    const items = await listQueueItems(pool,config);
    return jsonNoStore({enabled:true,syntheticOnly:true,items});
  } catch { return jsonNoStore({error:'Private queue unavailable'},503); }
}
export async function POST(request: NextRequest): Promise<Response> {
  const operator = await approvedOperator(request);
  if (!operator) return jsonNoStore({error:'Not found'},404);
  if (!sameOriginWrite(request)) return jsonNoStore({error:'Cross-origin write denied'},403);
  const config = configuredQueue();
  if (!config || !config.enabled) return jsonNoStore({enabled:false,syntheticOnly:true},503);
  const input = await readBoundedJson(request);
  if (!input || Object.keys(input).length !== 1 || typeof input.sampleId !== 'string' || !/^E-00[1-4]$/.test(input.sampleId)) {
    return jsonNoStore({error:'A predefined synthetic sample ID is required'},422);
  }
  try {
    const pool = await connectQueue(config,process.env.NODE_ENV);
    const result = await insertSyntheticQueueItem(pool,config,operator,input.sampleId);
    return jsonNoStore({synthetic:true,saved:true,...result},201);
  } catch { return jsonNoStore({error:'Unable to save sample'},503); }
}

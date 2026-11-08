import type { NextRequest } from 'next/server';
import { configuredQueue, approvedOperator, sameOriginWrite, jsonNoStore, readBoundedJson } from '@/lib/concierge/queue-request';
import { isQueueId } from '@/lib/concierge/secure-queue.mjs';
import { connectQueue, reviewQueueItem } from '@/lib/concierge/queue-store.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context): Promise<Response> {
  const operator = await approvedOperator(request);
  if (!operator) return jsonNoStore({error:'Not found'},404);
  if (!sameOriginWrite(request)) return jsonNoStore({error:'Cross-origin write denied'},403);
  const config = configuredQueue();
  if (!config || !config.enabled) return jsonNoStore({enabled:false,syntheticOnly:true},503);
  const {id} = await context.params;
  const input = await readBoundedJson(request);
  if (!isQueueId(id) || !input || Object.keys(input).length !== 2 ||
      typeof input.nextStatus !== 'string' || typeof input.expectedVersion !== 'number' ||
      !Number.isInteger(input.expectedVersion)) {
    return jsonNoStore({error:'Invalid review decision'},422);
  }
  try {
    const pool = await connectQueue(config,process.env.NODE_ENV);
    const result = await reviewQueueItem(pool,config,{
      id,actorId:operator,nextStatus:input.nextStatus,expectedVersion:input.expectedVersion,
    });
    return result ? jsonNoStore({synthetic:true,updated:true,...result}) : jsonNoStore({error:'Not found'},404);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'QUEUE_VERSION_CONFLICT') {
      return jsonNoStore({error:'This record changed. Refresh before deciding.'},409);
    }
    if (error instanceof TypeError || (error instanceof Error && error.message === 'Forbidden status transition')) {
      return jsonNoStore({error:'Review transition not allowed'},422);
    }
    return jsonNoStore({error:'Unable to save review decision'},503);
  }
}

import { Queue, Worker } from 'bullmq';

import { getBullRedis, getRedis } from '@shared/db/redis';
import { logger } from '@shared/logger';

import { createOperationsIngestion } from './index';

const NAME = 'regulatory-ingestion';
const HEARTBEAT = 'vitalink:operations:heartbeat';
const HEARTBEAT_SECONDS = 45;
const HEARTBEAT_MS = 15000;
const HOURLY_MS = 3600000;
let queue: Queue | null = null;
function getQueue(): Queue {
  queue ??= new Queue(NAME, { connection: getBullRedis() });
  return queue;
}
export async function queueRefresh(): Promise<{ queued: boolean }> {
  await getQueue().add(
    'refresh',
    {},
    { jobId: 'manual-refresh', removeOnComplete: true, removeOnFail: true },
  );
  return { queued: true };
}
export async function workerStatus(): Promise<{ online: boolean; lastSeen: string | null }> {
  const lastSeen = await getRedis().get(HEARTBEAT);
  return { online: lastSeen !== null, lastSeen };
}
export async function startOperationsWorker(): Promise<() => Promise<void>> {
  const ingestion = createOperationsIngestion();
  const worker = new Worker(NAME, async () => ingestion.sync(), {
    connection: getBullRedis(),
    concurrency: 1,
  });
  worker.on('failed', (_job, error) => {
    logger.error({ err: error }, 'Regulatory refresh failed');
  });
  worker.on('error', (error) => {
    logger.error({ err: error }, 'Regulatory worker error');
  });
  const beat = async (): Promise<void> => {
    await getRedis().set(HEARTBEAT, new Date().toISOString(), 'EX', HEARTBEAT_SECONDS);
  };
  await beat();
  const timer = setInterval(() => {
    void beat().catch((error: unknown) => {
      logger.warn({ err: error }, 'Worker heartbeat failed');
    });
  }, HEARTBEAT_MS);
  await getQueue().upsertJobScheduler(
    'hourly-regulatory',
    { every: HOURLY_MS },
    { name: 'refresh', data: {}, opts: { removeOnComplete: true, removeOnFail: true } },
  );
  await queueRefresh();
  return async () => {
    clearInterval(timer);
    await worker.close();
    await getQueue().close();
    await getRedis().del(HEARTBEAT);
  };
}

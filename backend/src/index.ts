import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';

const app = express();
app.use(cors());
app.use(express.json());

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const queueName = 'demo-jobs';
const queue = new Queue(queueName, { connection });
const queueEvents = new QueueEvents(queueName, { connection });

const subscribers = new Set<express.Response>();

type RealtimeEvent = {
  type: 'job-added' | 'job-active' | 'job-progress' | 'job-completed' | 'job-failed';
  jobId: string;
  message: string;
  data?: unknown;
  timestamp: string;
};

type JobSnapshot = {
  id: string;
  state: string;
  progress: number | object;
  updatedAt: string;
};

const eventHistory: RealtimeEvent[] = [];
const maxHistory = 200;
const jobsRuntimeStore = new Map<string, JobSnapshot>();

const saveEvent = (event: RealtimeEvent) => {
  eventHistory.unshift(event);

  if (eventHistory.length > maxHistory) {
    eventHistory.pop();
  }
};

const upsertJob = (job: JobSnapshot) => {
  jobsRuntimeStore.set(job.id, job);
};

const sendEvent = (payload: RealtimeEvent) => {
  saveEvent(payload);

  const body = `data: ${JSON.stringify(payload)}\n\n`;

  for (const response of subscribers) {
    response.write(body);
  }
};

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', frontendOrigin);

  res.write('retry: 3000\n\n');
  subscribers.add(res);

  req.on('close', () => {
    subscribers.delete(res);
  });
});

app.get('/runtime-data', (_, res) => {
  res.json({
    events: eventHistory,
    jobs: [...jobsRuntimeStore.values()],
  });
});

app.post('/jobs/start', async (_, res) => {
  const job = await queue.add('long-task', {
    startedAt: new Date().toISOString(),
  });

  sendEvent({
    type: 'job-added',
    jobId: job.id ?? 'unknown',
    message: `Job ${job.id} was added to queue`,
    timestamp: new Date().toISOString(),
  });

  upsertJob({
    id: job.id ?? 'unknown',
    state: 'waiting',
    progress: 0,
    updatedAt: new Date().toISOString(),
  });

  res.status(202).json({ jobId: job.id });
});

app.get('/jobs/:id', async (req, res) => {
  const job = await Job.fromId(queue, req.params.id);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  const state = await job.getState();
  const progress = job.progress;

  res.json({ id: job.id, name: job.name, state, progress });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const worker = new Worker(
  queueName,
  async (job) => {
    for (let progress = 20; progress <= 100; progress += 20) {
      await sleep(1000);
      await job.updateProgress(progress);
    }

    return { finishedAt: new Date().toISOString() };
  },
  { connection }
);

worker.on('active', (job) => {
  sendEvent({
    type: 'job-active',
    jobId: job.id ?? 'unknown',
    message: `Job ${job.id} started processing`,
    timestamp: new Date().toISOString(),
  });

  upsertJob({
    id: job.id ?? 'unknown',
    state: 'active',
    progress: job.progress,
    updatedAt: new Date().toISOString(),
  });
});

worker.on('progress', (job, progress) => {
  sendEvent({
    type: 'job-progress',
    jobId: job.id ?? 'unknown',
    message: `Job ${job.id} progress: ${progress}%`,
    data: progress,
    timestamp: new Date().toISOString(),
  });

  upsertJob({
    id: job.id ?? 'unknown',
    state: 'active',
    progress,
    updatedAt: new Date().toISOString(),
  });
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  sendEvent({
    type: 'job-completed',
    jobId,
    message: `Job ${jobId} finished successfully`,
    data: returnvalue,
    timestamp: new Date().toISOString(),
  });

  upsertJob({
    id: jobId,
    state: 'completed',
    progress: 100,
    updatedAt: new Date().toISOString(),
  });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  sendEvent({
    type: 'job-failed',
    jobId,
    message: `Job ${jobId} failed: ${failedReason}`,
    timestamp: new Date().toISOString(),
  });

  upsertJob({
    id: jobId,
    state: 'failed',
    progress: 0,
    updatedAt: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
  console.log(`Redis URL: ${redisUrl}`);
});

const shutdown = async () => {
  await worker.close();
  await queueEvents.close();
  await queue.close();
  await connection.quit();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

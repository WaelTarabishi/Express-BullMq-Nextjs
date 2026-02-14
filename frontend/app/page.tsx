'use client';

import { useEffect, useMemo, useState } from 'react';

type EventItem = {
  id: string;
  message: string;
  type: string;
  timestamp?: string;
};

type RuntimeJob = {
  id: string;
  state: string;
  progress: number | object;
  updatedAt: string;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<RuntimeJob[]>([]);

  useEffect(() => {
    const loadRuntimeData = async () => {
      const response = await fetch(`${backendUrl}/runtime-data`);
      const result = (await response.json()) as {
        events: { message: string; type: string; jobId: string; timestamp: string }[];
        jobs: RuntimeJob[];
      };

      setEvents(
        result.events.map((item, index) => ({
          id: `history-${index}-${item.jobId}`,
          message: item.message,
          type: item.type,
          timestamp: item.timestamp,
        }))
      );

      setJobs(result.jobs);

      if (result.events.length > 0) {
        setJobId(result.events[0].jobId);
      }
    };

    loadRuntimeData().catch(() => {
      // keep UI simple if backend is unavailable
    });
  }, []);

  useEffect(() => {
    const source = new EventSource(`${backendUrl}/events`);

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        message: string;
        type: string;
        jobId: string;
        data?: number;
        timestamp?: string;
      };

      setEvents((previous) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          message: payload.message,
          type: payload.type,
          timestamp: payload.timestamp ?? new Date().toISOString(),
        },
        ...previous,
      ]);

      setJobId(payload.jobId);

      setJobs((current) => {
        const existing = current.find((item) => item.id === payload.jobId);
        const nextState =
          payload.type === 'job-completed'
            ? 'completed'
            : payload.type === 'job-failed'
              ? 'failed'
              : payload.type === 'job-active' || payload.type === 'job-progress'
                ? 'active'
                : 'waiting';

        const nextProgress =
          payload.type === 'job-progress' ? Number(payload.data ?? 0) : existing?.progress ?? 0;

        const nextJob: RuntimeJob = {
          id: payload.jobId,
          state: nextState,
          progress: nextProgress,
          updatedAt: new Date().toISOString(),
        };

        if (!existing) {
          return [nextJob, ...current];
        }

        return [nextJob, ...current.filter((item) => item.id !== payload.jobId)];
      });
    };

    return () => source.close();
  }, []);

  const startJob = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/jobs/start`, { method: 'POST' });
      const result = (await response.json()) as { jobId: string };
      setJobId(result.jobId);
    } finally {
      setLoading(false);
    }
  };

  const statusText = useMemo(() => {
    if (!events.length) {
      return 'No events yet. Click “Start Job”.';
    }

    return events[0].message;
  }, [events]);

  return (
    <main className="container">
      <h1>BullMQ + Next.js (Realtime SSE)</h1>
      <p>This tiny demo pushes a job to BullMQ and streams status updates in real time.</p>

      <div className="controls">
        <button onClick={startJob} disabled={loading}>
          {loading ? 'Starting...' : 'Start Job'}
        </button>
        <span>{jobId ? `Current Job ID: ${jobId}` : 'No active job'}</span>
      </div>

      <div className="status">Latest: {statusText}</div>

      <ul className="eventList">
        {events.map((item) => (
          <li key={item.id} className={`event ${item.type}`}>
            {item.message}
            {item.timestamp ? <small> ({new Date(item.timestamp).toLocaleTimeString()})</small> : null}
          </li>
        ))}
      </ul>

      <h2>Runtime Jobs (survive refresh)</h2>
      <ul className="eventList">
        {jobs.map((item) => (
          <li key={item.id} className="event">
            <strong>{item.id}</strong> — {item.state} — progress: {String(item.progress)}
          </li>
        ))}
      </ul>
    </main>
  );
}

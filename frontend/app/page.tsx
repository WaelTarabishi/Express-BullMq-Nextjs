'use client';

import { useEffect, useMemo, useState } from 'react';

type EventItem = {
  id: string;
  message: string;
  type: string;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const source = new EventSource(`${backendUrl}/events`);

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { message: string; type: string; jobId: string };

      setEvents((previous) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          message: payload.message,
          type: payload.type,
        },
        ...previous,
      ]);

      setJobId(payload.jobId);
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
          </li>
        ))}
      </ul>
    </main>
  );
}

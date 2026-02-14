import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BullMQ + Next.js Realtime Demo',
  description: 'Simple queue processing with SSE updates',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

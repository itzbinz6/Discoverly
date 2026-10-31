import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Discoverly — Find videos that fit you',
  description: 'Discover useful YouTube videos based on your interests, goals, and preferences.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GTMI',
  description: 'Global Talent Migration Index',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
